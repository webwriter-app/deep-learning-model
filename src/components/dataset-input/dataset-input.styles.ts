import { css } from "lit";

export default css`
  :host {
    display: block;
    position: relative;
    min-height: 160px;
  }

  .select {
    width: min(20%, 100%);
    min-width: 12rem;
  }

  .overlay {
    position: absolute; /* To overlay the .page div */
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8); /* Black background with opacity */
    display: flex; /* Flexbox for centering */
    justify-content: center; /* Center horizontally */
    align-items: center; /* Center vertically */
    z-index: 100;
  }

  #file-input-label:hover {
    color: blue;
  }

  @media print {
    :host {
      display: none;
    }
  }
`;
