KAHAWA MKONONI – Customer Portal (Flutter)

This is the mobile Customer Portal app. It uses the existing KAHAWA MKONONI backend GraphQL API (no duplicated backend).

## Prerequisites
- Flutter SDK installed
- A running backend API (default: `http://localhost:4000/graphql`)

## Configure API URL
For Android emulator:
- Use `http://10.0.2.2:4000/graphql`

For physical device:
- Use your computer LAN IP, e.g. `http://192.168.1.10:4000/graphql`

Run with:
- `flutter run --dart-define=API_URL=http://10.0.2.2:4000/graphql`

## Install dependencies
- `flutter pub get`

## App structure
- `lib/models` – data models
- `lib/services/api` – GraphQL client + repositories
- `lib/providers` – Riverpod state management
- `lib/screens` – UI screens
- `lib/widgets` – reusable widgets
- `lib/utils` – config, theme, helpers

