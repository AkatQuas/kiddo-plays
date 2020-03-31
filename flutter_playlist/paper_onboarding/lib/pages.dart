import 'package:flutter/material.dart';

final pages = [
  PageViewModel(
    Color(0xFF678FB4),
    'assets/hotels.png',
    'Hotels',
    'All hotels and hotels are sorted by hospitality rating',
    'assets/key.png',
  ),
  PageViewModel(
    Color(0xFF65B0B4),
    'assets/banks.png',
    'Banks',
    'We carefully verify all banks before adding them into the app',
    'assets/wallet.png',
  ),
  PageViewModel(
    Color(0xFF9B90BC),
    'assets/stores.png',
    'Store',
    'All local stores are categorized for your convenience',
    'assets/shopping_cart.png',
  ),
];

class PageViewModel {
  final Color color;
  final String heroAssetPath;
  final String title;
  final String content;
  final String iconAssetPath;

  PageViewModel(
    this.color,
    this.heroAssetPath,
    this.title,
    this.content,
    this.iconAssetPath,
  );
}

class Page extends StatelessWidget {
  final PageViewModel viewModel;
  final double percentVisible;

  const Page({
    Key key,
    @required this.viewModel,
    this.percentVisible = 1.0,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      color: viewModel.color,
      width: double.infinity,
      child: Opacity(
        opacity: percentVisible,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Transform(
              transform: Matrix4.translationValues(
                0.0,
                50 * (1.0 - percentVisible),
                0.0,
              ),
              child: Padding(
                padding: const EdgeInsets.only(bottom: 25.0),
                child: Image.asset(
                  viewModel.heroAssetPath,
                  width: 200.0,
                  height: 200.0,
                ),
              ),
            ),
            Transform(
              transform: Matrix4.translationValues(
                0.0,
                30.0 * (1 - percentVisible),
                0.0,
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10.0),
                child: Text(
                  viewModel.title,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 34,
                  ),
                ),
              ),
            ),
            Transform(
              transform: Matrix4.translationValues(
                0.0,
                30.0 * (1 - percentVisible),
                0.0,
              ),
              child: Padding(
                padding: const EdgeInsets.only(bottom: 75.0),
                child: Text(
                  viewModel.content,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
