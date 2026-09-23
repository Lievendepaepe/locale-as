/*
 * ifcgeom.js — IFC-geometrie voor stap 4 (hoekpunten van geselecteerde platen).
 * Werkt met een web-ifc IfcAPI-instantie. Alle uitvoer in mm, IFC-assen (Z omhoog).
 */
(function (root) {
  "use strict";

  const CFG = {
    MERGE_MM: 0.05,     // hoekpunten binnen deze afstand worden samengevoegd
    NORMAL_SAME: 0.995, // normalen met cos > dit gelden als dezelfde richting
    CORNER_DET: 0.3     // min. |n1·(n2×n3)| voor een echt hoekpunt (filtert gatafrondingen)
  };

  /* ---------- IFC GUID ---------- */
  const B64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
  function guidToHex(g) {
    if (!g) return "";
    const s = String(g).trim();
    if (s.length !== 22) return s.replace(/[-{}]/g, "").toLowerCase(); // al 'uncompressed'
    const val = (str) => [...str].reduce((a, c) => a * 64 + B64.indexOf(c), 0);
    const bytes = [val(s.slice(0, 2))];
    for (let i = 2; i < 22; i += 4) {
      const v = val(s.slice(i, i + 4));
      bytes.push((v >> 16) & 255, (v >> 8) & 255, v & 255);
    }
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /* ---------- Model-index ---------- */
  function buildIndex(W, api, modelID) {
    const byGuid = new Map(), children = new Map(), info = new Map();
    const rels = api.GetLineIDsWithType(modelID, W.IFCRELAGGREGATES);
    for (let i = 0; i < rels.size(); i++) {
      const r = api.GetLine(modelID, rels.get(i));
      const p = r.RelatingObject && r.RelatingObject.value;
      const kids = (r.RelatedObjects || []).map((o) => o.value);
      if (p != null) children.set(p, (children.get(p) || []).concat(kids));
    }
    const ids = new Set(children.keys());
    api.StreamAllMeshes(modelID, (m) => ids.add(m.expressID));
    for (const id of ids) {
      try {
        const l = api.GetLine(modelID, id);
        if (l && l.GlobalId) {
          byGuid.set(guidToHex(l.GlobalId.value), id);
          info.set(id, { name: (l.Name && l.Name.value) || "", tag: (l.Tag && l.Tag.value) || "", type: l.constructor ? l.constructor.name : "" });
        }
      } catch (e) { /* overslaan */ }
    }
    return { byGuid, children, info };
  }

  function expandIds(index, ids) {
    const out = new Set(), stack = [...ids];
    while (stack.length) {
      const id = stack.pop(); if (out.has(id)) continue;
      out.add(id); (index.children.get(id) || []).forEach((k) => stack.push(k));
    }
    return [...out];
  }

  /* ---------- Geometrie ---------- */
  // web-ifc levert meter en Y-omhoog; terug naar IFC-assen in mm.
  const toIfcMm = (x, y, z) => [x * 1000, -z * 1000, y * 1000];

  function getTriangles(api, modelID, expressIDs) {
    const tris = [];
    api.StreamMeshes(modelID, expressIDs, (mesh) => {
      const gs = mesh.geometries;
      for (let i = 0; i < gs.size(); i++) {
        const pg = gs.get(i), T = pg.flatTransformation;
        const geo = api.GetGeometry(modelID, pg.geometryExpressID);
        const v = api.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize());
        const idx = api.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize());
        const P = (k) => {
          const x = v[k * 6], y = v[k * 6 + 1], z = v[k * 6 + 2];
          return toIfcMm(T[0] * x + T[4] * y + T[8] * z + T[12], T[1] * x + T[5] * y + T[9] * z + T[13], T[2] * x + T[6] * y + T[10] * z + T[14]);
        };
        for (let t = 0; t < idx.length; t += 3) tris.push([P(idx[t]), P(idx[t + 1]), P(idx[t + 2])]);
        geo.delete();
      }
    });
    return tris;
  }

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);

  // Echte hoekpunten: punten waar minstens drie duidelijk verschillende vlakken samenkomen.
  function cornerPoints(tris) {
    const q = CFG.MERGE_MM, map = new Map();
    for (const [a, b, c] of tris) {
      const n = cross(sub(b, a), sub(c, a)), l = len(n);
      if (l < 1e-9) continue;
      const nn = [n[0] / l, n[1] / l, n[2] / l];
      for (const p of [a, b, c]) {
        const key = p.map((v) => Math.round(v / q)).join(",");
        let e = map.get(key);
        if (!e) { e = { p, normals: [] }; map.set(key, e); }
        if (!e.normals.some((m) => dot(m, nn) > CFG.NORMAL_SAME)) e.normals.push(nn);
      }
    }
    const out = [];
    for (const e of map.values()) {
      const N = e.normals; if (N.length < 3) continue;
      let ok = false;
      for (let i = 0; i < N.length && !ok; i++)
        for (let j = i + 1; j < N.length && !ok; j++)
          for (let k = j + 1; k < N.length && !ok; k++)
            if (Math.abs(dot(N[i], cross(N[j], N[k]))) >= CFG.CORNER_DET) ok = true;
      if (ok) out.push(e.p);
    }
    return out;
  }

  function aabb(tris) {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const t of tris) for (const p of t) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p[i]); mx[i] = Math.max(mx[i], p[i]); }
    return { min: mn, max: mx };
  }

  const IfcGeom = { CFG, guidToHex, buildIndex, expandIds, getTriangles, cornerPoints, aabb };
  if (typeof module !== "undefined" && module.exports) module.exports = IfcGeom;
  else root.IfcGeom = IfcGeom;
})(typeof window !== "undefined" ? window : globalThis);
