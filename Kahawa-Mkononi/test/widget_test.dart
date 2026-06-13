import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kahawa_mkononi_customer/main.dart';
import 'package:kahawa_mkononi_customer/router/app_router.dart';

void main() {
  testWidgets('App builds (smoke test)', (WidgetTester tester) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const Scaffold(body: Text('Smoke')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [routerProvider.overrideWithValue(router)],
        child: const KahawaCustomerApp(),
      ),
    );

    expect(find.text('Smoke'), findsOneWidget);
  });
}
