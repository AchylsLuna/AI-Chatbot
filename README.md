# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    # AI Healthcare Landing Page

    Single-page React + TypeScript + Vite implementation of the provided healthcare hero design using Tailwind CSS and a reusable navigation component.

    ## Scripts

    - npm install – install dependencies
    - npm run dev – start the dev server
    - npm run build – create a production build
    - npm run preview – preview the production build locally

    ## Tech

    - Tailwind CSS 3 for styling (utilities, custom tokens in tailwind.config.js)
    - Reusable components: NavBar, LogoMark, PrimaryButton, GhostButton
    - Vite + TypeScript

    ## Notes

    - Global styles and Tailwind directives live in src/index.css.
    - Design tokens (colors, font, shadows, gradient) are set in tailwind.config.js.
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
