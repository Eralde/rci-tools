/**
 * Finds Y coordinate of a `pathEl` path point with given X coordinate.
 * Adopted from https://stackoverflow.com/a/12541696
 */
export const getYValueForX = (
  x: number,
  pathEl: SVGPathElement,
  eps: number = 0.01,
): number => {
  const pathLength = pathEl.getTotalLength();

  let beginning = x;
  let end = pathLength;
  let target: number, pos: DOMPoint;

  while (true) {
    target = Math.floor((beginning + end) / 2);
    pos = pathEl.getPointAtLength(target);

    if (
      (target === end || target === beginning)
      && pos.x !== x
    ) {
      break;
    }

    const diff = Math.abs(pos.x - x);

    if (diff < eps) { // close enough
      break;
    }

    if (pos.x > x) {
      end = target;
    } else {
      beginning = target;
    }
  }

  return pos.y;
};
