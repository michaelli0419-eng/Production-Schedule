# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Local Excel Sync

Run the website and the Excel sync server in two terminals:

```bash
npm run dev
npm run dev:excel
```

The sync server reads and writes this workbook by default:

```text
C:\Users\Michael Li\OneDrive - Webb Family Enterprises\SCM AI\production_schedule.xlsx
```

Use `Sync Excel` in the app to load the workbook into the scheduler. Use `Save Excel` to write the current scheduler back to the workbook. Close the workbook in desktop Excel before saving if Excel locks the file.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
