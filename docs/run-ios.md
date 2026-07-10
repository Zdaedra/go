# Запуск приложения на iPhone (Mac + Xcode)

Нативная сборка через Xcode — настоящее приложение на телефоне,
без Expo Go и веб-обёрток.

## Что нужно один раз

1. **Xcode** из App Store (открыть хотя бы раз, согласиться с лицензией).
2. Командные инструменты и CocoaPods:
   ```bash
   xcode-select --install        # если ещё не стоят
   sudo gem install cocoapods    # или: brew install cocoapods
   ```
3. **Node.js LTS** (если нет): `brew install node`.
4. На iPhone: Настройки → Конфиденциальность и безопасность →
   **Режим разработчика** → включить (iOS 16+), перезагрузить телефон.

## Получить проект

```bash
git clone https://github.com/Zdaedra/go.git
cd go
git checkout claude/go-openings-extraction-vxunif
cd apps/mobile
npm install
```

## Собрать и поставить на телефон

Подключи iPhone кабелем (первый раз — «Доверять этому компьютеру»),
затем:

```bash
npx expo run:ios --device
```

- Выбери свой iPhone из списка.
- При первом запуске Xcode попросит команду подписи: открой
  `ios/goopeningsmobile.xcworkspace`, в разделе **Signing & Capabilities**
  выбери свой Apple ID (бесплатный аккаунт подходит) и уникальный
  Bundle Identifier, затем повтори команду.
- На телефоне после установки: Настройки → Основные → VPN и управление
  устройством → доверять своему сертификату разработчика.

После первой сборки достаточно `npx expo start` — приложение на
телефоне подхватывает JS-изменения по Wi-Fi (телефон и Mac в одной
сети), пересобирать через Xcode нужно только при смене нативных
зависимостей.

## Если сборка падает с «No Accounts» / «No profiles»

`npx expo run:ios` и даже `xcodebuild -allowProvisioningUpdates` из
терминала могут не видеть Apple-аккаунт, даже когда в Xcode → Settings →
Apple Accounts всё залогинено (наблюдалось на Xcode 26.5: CLI не получает
доступ к сессии аккаунта). Рабочий обход:

1. `open ios/99.xcworkspace`
2. В Xcode выбери устройством свой iPhone и нажми **Run** — GUI сам
   зарегистрирует bundle ID и выпустит provisioning-профиль.
3. Дальше JS-правки идут через `npx expo start` без пересборки;
   Run в Xcode нужен только при смене нативных зависимостей.

Если приложение запустилось с ошибкой «No bundle URL present» — Metro не
был запущен в момент старта: запусти `npx expo start` и перезапусти
приложение.

## Примечания

- Бесплатная подпись Apple живёт 7 дней — потом просто пересобери
  (`npx expo run:ios --device`). Для постоянной установки нужен
  Apple Developer Program ($99/год) или TestFlight.
- Бэкенд не обязателен: без `EXPO_PUBLIC_API_URL` приложение работает
  в гостевом режиме (вход «Продолжить без аккаунта»), весь контент
  локальный. Когда развернём FastAPI-бэкенд, адрес задаётся так:
  ```bash
  EXPO_PUBLIC_API_URL=https://api.example.com npx expo start
  ```
- Android-вариант: `npx expo run:android` при установленном
  Android Studio.
