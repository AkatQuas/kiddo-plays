export class FilePathScoreFunction {
  query;
  queryUpperCase;
  score;
  sequence;
  dataUpperCase;
  fileNameIndex;
  constructor(query) {
    this.query = query;
    this.queryUpperCase = query.toUpperCase();
    this.score = new Int32Array(20 * 100);
    this.sequence = new Int32Array(20 * 100);
    this.dataUpperCase = "";
    this.fileNameIndex = 0;
  }
  calculateScore(data, matchIndexes) {
    if (!data || !this.query) {
      return 0;
    }
    const n = this.query.length;
    const m = data.length;
    if (!this.score || this.score.length < n * m) {
      this.score = new Int32Array(n * m * 2);
      this.sequence = new Int32Array(n * m * 2);
    }
    const score = this.score;
    const sequence = this.sequence;
    this.dataUpperCase = data.toUpperCase();
    this.fileNameIndex = data.lastIndexOf("/");
    for (let i = 0; i < n; ++i) {
      for (let j = 0; j < m; ++j) {
        const skipCharScore = j === 0 ? 0 : score[i * m + j - 1];
        const prevCharScore = i === 0 || j === 0 ? 0 : score[(i - 1) * m + j - 1];
        const consecutiveMatch = i === 0 || j === 0 ? 0 : sequence[(i - 1) * m + j - 1];
        const pickCharScore = this.match(this.query, data, i, j, consecutiveMatch);
        if (pickCharScore && prevCharScore + pickCharScore >= skipCharScore) {
          sequence[i * m + j] = consecutiveMatch + 1;
          score[i * m + j] = prevCharScore + pickCharScore;
        } else {
          sequence[i * m + j] = 0;
          score[i * m + j] = skipCharScore;
        }
      }
    }
    if (matchIndexes) {
      this.restoreMatchIndexes(sequence, n, m, matchIndexes);
    }
    const maxDataLength = 256;
    return score[n * m - 1] * maxDataLength + (maxDataLength - data.length);
  }
  testWordStart(data, j) {
    if (j === 0) {
      return true;
    }
    const prevChar = data.charAt(j - 1);
    return prevChar === "_" || prevChar === "-" || prevChar === "/" || prevChar === "." || prevChar === " " || data[j - 1] !== this.dataUpperCase[j - 1] && data[j] === this.dataUpperCase[j];
  }
  restoreMatchIndexes(sequence, n, m, out) {
    let i = n - 1, j = m - 1;
    while (i >= 0 && j >= 0) {
      switch (sequence[i * m + j]) {
        case 0:
          --j;
          break;
        default:
          out.push(j);
          --i;
          --j;
          break;
      }
    }
    out.reverse();
  }
  singleCharScore(query, data, i, j) {
    const isWordStart = this.testWordStart(data, j);
    const isFileName = j > this.fileNameIndex;
    const isPathTokenStart = j === 0 || data[j - 1] === "/";
    const isCapsMatch = query[i] === data[j] && query[i] === this.queryUpperCase[i];
    let score = 10;
    if (isPathTokenStart) {
      score += 4;
    }
    if (isWordStart) {
      score += 2;
    }
    if (isCapsMatch) {
      score += 6;
    }
    if (isFileName) {
      score += 4;
    }
    if (j === this.fileNameIndex + 1 && i === 0) {
      score += 5;
    }
    if (isFileName && isWordStart) {
      score += 3;
    }
    return score;
  }
  sequenceCharScore(query, data, i, j, sequenceLength) {
    const isFileName = j > this.fileNameIndex;
    const isPathTokenStart = j === 0 || data[j - 1] === "/";
    let score = 10;
    if (isFileName) {
      score += 4;
    }
    if (isPathTokenStart) {
      score += 5;
    }
    score += sequenceLength * 4;
    return score;
  }
  match(query, data, i, j, consecutiveMatch) {
    if (this.queryUpperCase[i] !== this.dataUpperCase[j]) {
      return 0;
    }
    if (!consecutiveMatch) {
      return this.singleCharScore(query, data, i, j);
    }
    return this.sequenceCharScore(query, data, i, j - consecutiveMatch, consecutiveMatch);
  }
}
//# sourceMappingURL=FilePathScoreFunction.js.map
