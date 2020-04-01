import 'dart:html';
import 'dart:math';

InputElement toDoInput;
UListElement toDoList;
ButtonElement addOne;
ButtonElement deleteAll;

String scrabbleLetters =
    'aaaaaaaaabbccddddeeeeeeeeeeeeffggghhiiiiiiiiijkllllmmnnnnnnooooooooppqrrrrrrssssttttttuuuuvvwwxyyz**';

List<ButtonElement> buttons = new List();
DivElement letterpile;
DivElement result;
ButtonElement clearButton;
ParagraphElement value;
int wordvalue = 0;

Map scrabbleValues = {
  'a': 1,
  'e': 1,
  'i': 1,
  'l': 1,
  'n': 1,
  'o': 1,
  'r': 1,
  's': 1,
  't': 1,
  'u': 1,
  'd': 2,
  'g': 2,
  'b': 3,
  'c': 3,
  'm': 3,
  'p': 3,
  'f': 4,
  'h': 4,
  'v': 4,
  'w': 4,
  'y': 4,
  'k': 5,
  'j': 8,
  'x': 8,
  'q': 10,
  'z': 10,
  '*': 0
};

void main() {
  print(scrabbleValues.keys.toList());
  toDoInput = querySelector('#to-do-input');
  toDoList = querySelector('#to-do-list');
  toDoInput.onChange.listen(addToDoItem);
  addOne = querySelector('#add-one');
  addOne.onClick.listen(addOneItem);
  deleteAll = querySelector('#delete-all');
  deleteAll.onClick.listen((e) => toDoList.children.clear());

  letterpile = querySelector('#letterpile');
  result = querySelector('#result');
  value = querySelector('#value');
  clearButton = querySelector('#clearButton');
  clearButton.onClick.listen(newletters);

  generateNewLetters();
}

void addOneItem(Event e) {
  var value = toDoInput.value;
  if (value == '') {
    return window.alert('Can not add empty');
  }

  var newToDo = new LIElement();
  newToDo.text = toDoInput.value;
  newToDo.onClick.listen((e) => newToDo.remove());
  toDoInput.value = '';
  toDoList.children.add(newToDo);
}

void addToDoItem(Event e) {
  print(e);
  var newToDo = new LIElement();
  newToDo.text = toDoInput.value;
  newToDo.onClick.listen((e) => newToDo.remove());
  toDoInput.value = '';
  toDoList.children.add(newToDo);
}

void moveLetter(Event e) {
  Element letter = e.target;
  if (letter.parent == letterpile) {
    result.children.add(letter);
    wordvalue += scrabbleValues[letter.text];
    value.text = '$wordvalue';
  } else {
    letterpile.children.add(letter);
    wordvalue -= scrabbleValues[letter.text];
    value.text = '$wordvalue';
  }
}

void newletters(Event e) {
  letterpile.children.clear();
  result.children.clear();
  generateNewLetters();
}

generateNewLetters() {
  Random indexGenerator = new Random();
  wordvalue = 0;
  value.text = '';
  buttons.clear();
  for (var i = 0; i < 7; i++) {
    int letterIndex = indexGenerator.nextInt(scrabbleLetters.length);
    buttons.add(new ButtonElement());
    buttons[i].classes.add('letter');
    buttons[i].onClick.listen(moveLetter);
    buttons[i].text = scrabbleLetters[letterIndex];
    letterpile.children.add(buttons[i]);
  }
}
