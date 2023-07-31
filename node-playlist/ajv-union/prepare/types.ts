interface Person {
  name: string;
  age: number;
}

interface AxeMan extends Person {
  weapon: string;
}

interface FireMan extends Person {
  wings: string;
}

// type Warrior = AxeMan | FireMan;

export interface Troop {
  amount: number;
  scene: AxeMan[];
  custom: FireMan[];
}
