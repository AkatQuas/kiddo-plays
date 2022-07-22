import * as Platform from "../platform/platform.js";
export class Segment {
  begin;
  end;
  data;
  constructor(begin, end, data) {
    if (begin > end) {
      throw new Error("Invalid segment");
    }
    this.begin = begin;
    this.end = end;
    this.data = data;
  }
  intersects(that) {
    return this.begin < that.end && that.begin < this.end;
  }
}
export class SegmentedRange {
  #segmentsInternal;
  #mergeCallback;
  constructor(mergeCallback) {
    this.#segmentsInternal = [];
    this.#mergeCallback = mergeCallback;
  }
  append(newSegment) {
    let startIndex = Platform.ArrayUtilities.lowerBound(this.#segmentsInternal, newSegment, (a, b) => a.begin - b.begin);
    let endIndex = startIndex;
    let merged = null;
    if (startIndex > 0) {
      const precedingSegment = this.#segmentsInternal[startIndex - 1];
      merged = this.tryMerge(precedingSegment, newSegment);
      if (merged) {
        --startIndex;
        newSegment = merged;
      } else if (this.#segmentsInternal[startIndex - 1].end >= newSegment.begin) {
        if (newSegment.end < precedingSegment.end) {
          this.#segmentsInternal.splice(startIndex, 0, new Segment(newSegment.end, precedingSegment.end, precedingSegment.data));
        }
        precedingSegment.end = newSegment.begin;
      }
    }
    while (endIndex < this.#segmentsInternal.length && this.#segmentsInternal[endIndex].end <= newSegment.end) {
      ++endIndex;
    }
    if (endIndex < this.#segmentsInternal.length) {
      merged = this.tryMerge(newSegment, this.#segmentsInternal[endIndex]);
      if (merged) {
        endIndex++;
        newSegment = merged;
      } else if (newSegment.intersects(this.#segmentsInternal[endIndex])) {
        this.#segmentsInternal[endIndex].begin = newSegment.end;
      }
    }
    this.#segmentsInternal.splice(startIndex, endIndex - startIndex, newSegment);
  }
  appendRange(that) {
    that.segments().forEach((segment) => this.append(segment));
  }
  segments() {
    return this.#segmentsInternal;
  }
  tryMerge(first, second) {
    const merged = this.#mergeCallback && this.#mergeCallback(first, second);
    if (!merged) {
      return null;
    }
    merged.begin = first.begin;
    merged.end = Math.max(first.end, second.end);
    return merged;
  }
}
//# sourceMappingURL=SegmentedRange.js.map
