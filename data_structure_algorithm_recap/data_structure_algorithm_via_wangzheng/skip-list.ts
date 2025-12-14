interface DataNode {
  down: DataNode;
  next: DataNode;
  key: number;
  value: string;
}

interface HeaderNode {
  down: HeaderNode;
  next: DataNode;
}

// AT "2022/02/04 20:14"
// TODO
//
class SkipList {
  header: HeaderNode;
  constructor() {}
}
