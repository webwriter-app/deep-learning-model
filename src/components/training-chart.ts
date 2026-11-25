import { CategoryScale, Chart, Legend, LineController, LineElement, LinearScale, PointElement, Title, Tooltip } from "chart.js";

Chart.register(CategoryScale, Legend, LineController, LineElement, LinearScale, PointElement, Title, Tooltip);

const PALETTE = ["#008ffb", "#00e396", "#feb019", "#775dd0", "#546e7a", "#26a69a", "#d10ce8"];

/** The series colors: the accent colors of the document theme where it sets them, else the palette. */
function seriesColors(canvas: HTMLCanvasElement) {
    const style = getComputedStyle(canvas);
    return PALETTE.map((color, i) => style.getPropertyValue(`--ww-theme-accent-${i + 1}`).trim() || color);
}

/** The line chart of the training metrics, drawn on a canvas. */
export class TrainingChart {
    private chart: Chart<"line">;
    private canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.chart = new Chart(canvas, {
            type: "line",
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                elements: { point: { radius: 0 }, line: { tension: 0.3, borderWidth: 2 } },
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: "Training Metrics", align: "start" },
                },
                scales: {
                    x: { ticks: { maxRotation: 90, autoSkip: true } },
                    y: { min: 0 },
                },
            },
        });
    }

    /** Shows the given series per epoch and marks the best point, if there is one. */
    update(series: [string, number[]][], best?: { index: number, value: number }) {
        const colors = seriesColors(this.canvas);
        let datasets: any[] = series.map(([label, data], i) => ({ label, data, borderColor: colors[i % colors.length], backgroundColor: colors[i % colors.length] }));
        let longest = series.reduce((n, [, values]) => Math.max(n, values.length), 0);
        if (best != null && series.length > 0) {
            let data = new Array(longest).fill(null);
            data[best.index] = best.value;
            datasets.push({ label: "Best", data, borderColor: "#FF4560", backgroundColor: "#fff", pointRadius: 6, pointBorderWidth: 2, showLine: false });
        }
        this.chart.data.labels = Array.from({ length: longest }, (_, i) => i);
        this.chart.data.datasets = datasets;
        this.chart.update();
    }

    destroy() {
        this.chart.destroy();
    }
}
