import 'package:flutter/material.dart';

import './answer.dart';
import './question.dart';

class Quiz extends StatelessWidget {
  final List<Map<String, Object>> questions;
  final Function answerQuestion;
  final int questionIndex;

  Quiz({
    @required this.questionIndex,
    @required this.questions,
    @required this.answerQuestion,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        Question(
          questions[questionIndex]['questionText'],
        ),
        Column(
          children: (questions[questionIndex]['answers'] as List<String>)
              .map((answer) {
            return Answer(answer, answerQuestion);
          }).toList(),
        )
      ],
    );
  }
}
