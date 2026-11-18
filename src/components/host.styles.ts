import { css } from "lit";

/**
 * The host styles that all widgets of this package share: the block, its width limits, the theme properties of the
 * document and a visible keyboard focus. Without a theme every value falls back to what the widgets looked like before.
 */
export const hostStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    min-width: min(300px, 100%);
    max-width: 2100px;
    container-type: inline-size;
    color: var(--ww-text-color, inherit);
    font-family: var(--ww-font-family, inherit);
    --sl-input-label-color: var(--ww-text-color, var(--sl-color-neutral-700));
  }
  :focus-visible {
    outline: 2px solid var(--ww-theme-accent-1, var(--sl-color-primary-600, #0284c7));
    outline-offset: 2px;
  }
  a {
    color: var(--ww-link-color, inherit);
  }
  @media print {
    :host {
      max-width: none;
      container-type: normal;
      color: var(--ww-text-color, #000);
    }
  }
`;
