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
C:\Users\Michael Li\OneDrive - Webb Family Enterprises\SCM AI\SCM Production Schedule - Master Excel (1).xlsx
```

Use `Sync Excel` in the app to load the `On Line Upcoming` sheet into the scheduler. The app reads the Line 1-4 sections and maps Topset Date, Shipping Date, and Set Date into the timeline. Use `Save Excel` to update the same master workbook rows. New website-only jobs are saved to a `Website Additions` sheet so the master schedule layout is not damaged. Close the workbook in desktop Excel before saving if Excel locks the file.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
