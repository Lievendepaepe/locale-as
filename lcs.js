/*
 * lcs.js — rekenkern voor lokale assenstelsels (geen afhankelijkheden).
 * Alle coördinaten in millimeter, als [x, y, z].
 */
(function (root) {
  "use strict";

  // Validatiegrenzen (mm). Aanpassen naar eigen praktijk.
  const LIMITS = {
    MIN_BASE: 500,      // minimale afstand O–X
    MIN_OFFSET: 200,    // minimale afstand van XY-punt tot de lijn O–X
    MIN_VERT: 0.1       // 2-puntmodus: X-as mag niet (bijna) verticaal zijn
  };

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);

  /**
   * Bouwt een rechtshandig lokaal stelsel.
   * mode "3p": O, PX, PXY  |  mode "2p": O, PX, Z volgt uit globale verticale.
   */
  function buildAxis(O, PX, PXY, mode) {
    const vx = sub(PX, O);
    const base = len(vx);
    if (base < LIMITS.MIN_BASE) {
      throw new Error(`Basislijn O–X is ${base.toFixed(0)} mm. Minimum is ${LIMITS.MIN_BASE} mm: kies X verder van O.`);
    }
    const x = scale(vx, 1 / base);
    let z, offset = null;

    if (mode === "3p") {
      if (!PXY) throw new Error("Derde punt (XY-vlak) ontbreekt.");
      const c = cross(x, sub(PXY, O));
      offset = len(c); // = loodrechte afstand van PXY tot lijn O–X
      if (offset < LIMITS.MIN_OFFSET) {
        throw new Error(`XY-punt ligt ${offset.toFixed(0)} mm van de X-as. Minimum is ${LIMITS.MIN_OFFSET} mm: kies een punt verder van de lijn O–X.`);
      }
      z = scale(c, 1 / offset);
    } else {
      const up = [0, 0, 1];
      const zc = sub(up, scale(x, dot(up, x)));
      const d = len(zc);
      if (d < LIMITS.MIN_VERT) throw new Error("X-as staat (bijna) verticaal: gebruik de 3-puntmethode.");
      z = scale(zc, 1 / d);
    }
    const y = cross(z, x);
    return { O: O.slice(), x, y, z, base, offset, mode };
  }

  function toLocal(axis, p) {
    const d = sub(p, axis.O);
    return [dot(d, axis.x), dot(d, axis.y), dot(d, axis.z)];
  }

  function toGlobal(axis, q) {
    return add(axis.O, add(add(scale(axis.x, q[0]), scale(axis.y, q[1])), scale(axis.z, q[2])));
  }

  // Omkeren/draaien zonder rechtshandigheid te breken.
  function flipX(a) { return { ...a, x: scale(a.x, -1), y: scale(a.y, -1) }; } // 180° om Z
  function flipY(a) { return { ...a, y: scale(a.y, -1), z: scale(a.z, -1) }; } // 180° om X
  function rotZ90(a) { return { ...a, x: a.y.slice(), y: scale(a.x, -1) }; }   // +90° om Z

  // Richtfout-indicatie: fout (mm) op afstand D bij snapfout e per punt.
  function angularErrorAt(axis, D, e) { return (e * D) / axis.base; }

  // Controle: orthonormaal en rechtshandig?
  function check(axis) {
    const n = [len(axis.x), len(axis.y), len(axis.z)];
    const o = [dot(axis.x, axis.y), dot(axis.y, axis.z), dot(axis.z, axis.x)];
    const rh = dot(cross(axis.x, axis.y), axis.z);
    return n.every((v) => Math.abs(v - 1) < 1e-9) && o.every((v) => Math.abs(v) < 1e-9) && rh > 0;
  }

  const LCS = { LIMITS, sub, add, scale, dot, cross, len, buildAxis, toLocal, toGlobal, flipX, flipY, rotZ90, angularErrorAt, check };
  if (typeof module !== "undefined" && module.exports) module.exports = LCS;
  else root.LCS = LCS;
})(typeof window !== "undefined" ? window : globalThis);
