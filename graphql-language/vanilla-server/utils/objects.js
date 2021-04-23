export class Message {
  constructor(id, { content, author }) {
    this.id = id;
    this.content = content;
    this.author = author;
  }
}

export class RandomDie {
  constructor(numSides) {
    this.numSides = numSides;
  }
  rollOnce() {
    return 1 + ~~(Math.random() * this.numSides);
  }

  roll({ numRolls }) {
    const result = [];
    for (let i = 0; i < numRolls; i++) {
      result.push(this.rollOnce());
    }
    return result;
  }
}

export class User {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }
}
