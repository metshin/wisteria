# 🪻 Wisteria Study

A calm little web app for timed SAT-style Reading & Writing practice, using questions you bring yourself.

**Live:** https://metshin.github.io/wisteria/

## What it does

- **Timed practice:** build a module (how many hard / medium / easy questions, which skills, how long) and take it on a
  Bluebook-style test screen with a question navigator, cross-out mode, highlights & notes and a timer you can hide.
- **Paste importer:** paste questions as plain text (question, four choices, answer; skill, difficulty and explanation are optional).
  Anything incomplete goes to a **Fix** queue so you can correct it by hand.
- **PDF import:** load a Question Bank PDF you downloaded yourself. It's read in your browser; charts and tables are kept as pictures.
- **Markers:** 🚩 Mark for Review and 🌱 Confused, with filters on the results screen and in History.
- **Retest queue:** wrong and skipped questions come back until you get them right, and you can retest only the wrong ones.
- **Pomodoro study timer:** a fruit that ripens as you study, with breaks you take when you like (and an optional short breathing break).
- **Progress report:** accuracy, wrong vs skipped, time per skill, trends and your own notes, to copy or download as Markdown.
- Also: a word bank with flashcards, a word of the day, a study log and a test-day countdown.

## Bring your own practice material

No questions are included. You supply your own, for example by pasting questions you wrote or collected,
or by importing a PDF you downloaded for personal use. Please respect the copyright of whatever you import.

Your data is stored in your browser (IndexedDB). Clearing site data, or switching browser or device, starts you fresh.

## Run it locally

You need [Node.js](https://nodejs.org) 20.19 or newer.

```
npm install
npm run dev
```

Then open the address it prints (http://127.0.0.1:5173/wisteria/).

Other commands: `npm test`, `npm run typecheck`, `npm run build`.

## License

[MIT](LICENSE)

## Disclaimer

Not affiliated with or endorsed by College Board. SAT® is a trademark of College Board.
