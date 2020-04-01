import 'dart:ui';

import 'package:flutter/material.dart';

import './pages.dart';

class PagerIndicator extends StatelessWidget {
  const PagerIndicator({Key key, this.viewModel}) : super(key: key);

  final PagerIndicatorViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final List<PageBubble> bubbles = [];
    for (var i = 0; i < viewModel.pages.length; i++) {
      final page = viewModel.pages[i];
      var activePercent = 0.0;
      if (i == viewModel.activeIndex) {
        activePercent = 1.0 - viewModel.slidePercent;
      } else if ((i == viewModel.activeIndex - 1 &&
              viewModel.slideDirection == SlideDirection.leftToRight) ||
          (i == viewModel.activeIndex + 1 &&
              viewModel.slideDirection == SlideDirection.rightToLeft)) {
        activePercent = viewModel.slidePercent;
      } else {
        // pass
        // activePercent = 0.0;
      }

      bool isHollow = i > viewModel.activeIndex ||
          (i == viewModel.activeIndex &&
              viewModel.slideDirection == SlideDirection.leftToRight);
      bubbles.add(PageBubble(
        viewModel: PageBubbleViewModel(
          page.iconAssetPath,
          page.color,
          isHollow,
          activePercent,
        ),
      ));
    }
    const BUBBLEWIDTH = 55.0;
    final baseTranslation =
        (viewModel.pages.length * BUBBLEWIDTH) / 2 - (BUBBLEWIDTH / 2);
    var translation = baseTranslation - (BUBBLEWIDTH * viewModel.activeIndex);
    if (viewModel.slideDirection == SlideDirection.leftToRight) {
      translation += BUBBLEWIDTH * viewModel.slidePercent;
    } else if (viewModel.slideDirection == SlideDirection.rightToLeft) {
      translation -= BUBBLEWIDTH * viewModel.slidePercent;
    }
    return Column(
      children: <Widget>[
        Expanded(
          child: Container(),
        ),
        Transform(
          transform: Matrix4.translationValues(translation, 0.0, 0.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: bubbles,
          ),
        )
      ],
    );
  }
}

class PageBubble extends StatelessWidget {
  const PageBubble({
    Key key,
    this.viewModel,
  }) : super(key: key);

  final PageBubbleViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final l = lerpDouble(20.0, 45.0, viewModel.activePercent);
    return Container(
      width: 55.0,
      height: 65.0,
      child: Center(
        child: Container(
          width: l,
          height: l,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: viewModel.isHollow
                ? const Color(0x88FFFFFF)
                    .withAlpha((0x88 * viewModel.activePercent).round())
                : const Color(0x88FFFFFF),
            border: Border.all(
              color: viewModel.isHollow
                  ? const Color(0x88FFFFFF).withAlpha(
                      (0x88 * (1.0 - viewModel.activePercent)).round())
                  : Colors.transparent,
              width: 3.0,
            ),
          ),
          child: Opacity(
            opacity: viewModel.activePercent,
            child: Image.asset(
              viewModel.iconAssetPath,
              color: viewModel.color,
            ),
          ),
        ),
      ),
    );
  }
}

enum SlideDirection {
  leftToRight,
  rightToLeft,
  none,
}

class PagerIndicatorViewModel {
  final List<PageViewModel> pages;
  final int activeIndex;
  final SlideDirection slideDirection;
  final double slidePercent;

  PagerIndicatorViewModel(
    this.pages,
    this.activeIndex,
    this.slideDirection,
    this.slidePercent,
  );
}

class PageBubbleViewModel {
  final String iconAssetPath;
  final Color color;
  final bool isHollow;
  final double activePercent;

  PageBubbleViewModel(
    this.iconAssetPath,
    this.color,
    this.isHollow,
    this.activePercent,
  );
}
