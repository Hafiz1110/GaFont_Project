

const baseSizeInput = document.querySelector("#base-size");
const levelsInput = document.querySelector("#levels");
const baseSizeValue = document.querySelector("#base-size-value");
const levelsValue = document.querySelector("#levels-value");
const scaleSummary = document.querySelector("#scale-summary");
const scaleList = document.querySelector("#scale-list");
const typePreview = document.querySelector("#type-preview");
const copyButton = document.querySelector("#copy-css");
const copyStatus = document.querySelector("#copy-status");
const ratioNames = {
    "1.2": "Minor Third",
    "1.25": "Major Third",
    "1.5": "Perfect Fifth",
    "1.618": "Golden Ratio",
};

function getSelectedRatio() {
    const selectedRatio = document.querySelector('input[name="ratio"]:checked');
    return selectedRatio ? Number(selectedRatio.value) : 1.618;
}

function formatSize(size) {
    return `${Number(size.toFixed(2))}px`;
}

function createScale(baseSize, ratio, levels) {
    return Array.from({ length: levels + 1 }, (_, index) => {
        const level = index;
        return {
            level,
            size: baseSize * ratio ** index,
        };
    });
}

function renderScale(scale, ratio, baseSize) {
    const largestSize = scale[scale.length - 1].size;
    scaleSummary.replaceChildren();
    scaleSummary.append(document.createTextNode(ratioNames[String(ratio)]));
    const separator = document.createElement("span");
    separator.className = "px-1 text-[#737373]";
    separator.textContent = "·";
    scaleSummary.append(separator, document.createTextNode(` base ${baseSize}px`));
    scaleList.replaceChildren();

    scale.forEach(({ level, size }) => {
        const row = document.createElement("div");
        row.className = "grid min-h-[51px] grid-cols-[minmax(75px,1fr)_1fr_auto] items-center gap-3 border-b border-line";

        const label = document.createElement("span");
        label.className = "text-[11px] text-soft";
        label.textContent = level === 0 ? "Base" : `Level ${level}`;

        const track = document.createElement("span");
        track.className = "h-[5px] overflow-hidden rounded-full bg-[#292929]";
        track.setAttribute("aria-hidden", "true");

        const bar = document.createElement("span");
        bar.className = "block h-full min-w-1 rounded-full bg-dodger opacity-90";
        bar.style.width = `${(size / largestSize) * 100}%`;
        track.append(bar);

        const value = document.createElement("span");
        value.className = "min-w-[60px] text-right text-[13px] font-semibold tabular-nums text-white";
        value.textContent = formatSize(size);
        row.append(label, track, value);
        scaleList.append(row);
    });
}

function renderPreview(scale) {
    typePreview.replaceChildren();
    const headings = [...scale].filter(({ level }) => level > 0).reverse();

    headings.forEach(({ level, size }) => {
        const row = document.createElement("div");
        row.className = "border-t border-[#292929] pt-[13px] first:border-t-0 first:pt-0 [&:not(:first-child)]:mt-[15px]";

        const label = document.createElement("span");
        label.className = "mb-1.5 block text-[9px] tracking-[0.04em] text-muted";
        label.textContent = `Heading ${level} · ${formatSize(size)}`;

        const text = document.createElement("p");
        text.className = "m-0 font-semibold leading-[1.15] tracking-[-0.04em] text-white [overflow-wrap:anywhere]";
        text.style.fontSize = formatSize(size);
        text.textContent = level === headings[0].level ? "Bikin ide kamu lebih rapi." : "Tipografi yang terasa pas.";

        row.append(label, text);
        typePreview.append(row);
    });

    const base = scale.find(({ level }) => level === 0);
    const bodyRow = document.createElement("div");
    bodyRow.className = "border-t border-[#292929] pt-[13px] first:border-t-0 first:pt-0 [&:not(:first-child)]:mt-[15px]";

    const bodyLabel = document.createElement("span");
    bodyLabel.className = "mb-1.5 block text-[9px] tracking-[0.04em] text-muted";
    bodyLabel.textContent = `Body · ${formatSize(base.size)}`;

    const bodyText = document.createElement("p");
    bodyText.className = "m-0 font-normal leading-[1.55] tracking-normal text-soft [overflow-wrap:anywhere]";
    bodyText.style.fontSize = formatSize(base.size);
    bodyText.textContent = "Susun ukuran font yang konsisten dan mudah dibaca. Setiap level mengikuti rasio pilihanmu.";

    bodyRow.append(bodyLabel, bodyText);
    typePreview.append(bodyRow);
}

function getCssVariables(scale) {
    const declarations = scale
        .map(({ level, size }) => {
            const name = level === 0 ? "base" : level;
            return `  --font-size-${name}: ${formatSize(size)};`;
        })
        .join("\n");

    return `:root {\n${declarations}\n}`;
}

function updateGenerator() {
    const baseSize = Number(baseSizeInput.value);
    const levels = Number(levelsInput.value);
    const ratio = getSelectedRatio();
    const scale = createScale(baseSize, ratio, levels);

    baseSizeValue.value = `${baseSize}px`;
    levelsValue.value = `${levels} level`;
    renderScale(scale, ratio, baseSize);
    renderPreview(scale);
    copyStatus.textContent = "";
}

async function copyCss() {
    const baseSize = Number(baseSizeInput.value);
    const scale = createScale(baseSize, getSelectedRatio(), Number(levelsInput.value));
    const css = getCssVariables(scale);

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(css);
        } else {
            const temporaryInput = document.createElement("textarea");
            temporaryInput.value = css;
            temporaryInput.setAttribute("readonly", "");
            temporaryInput.style.position = "fixed";
            temporaryInput.style.opacity = "0";
            document.body.append(temporaryInput);
            temporaryInput.select();
            const copied = document.execCommand("copy");
            temporaryInput.remove();

            if (!copied) {
                throw new Error("Browser tidak mengizinkan penyalinan clipboard.");
            }
        }

        copyStatus.textContent = "CSS berhasil disalin.";
    } catch (error) {
        copyStatus.textContent = "Gagal menyalin. Coba jalankan halaman lewat Live Server.";
        console.error("Tidak dapat menyalin CSS:", error);
    }
}

baseSizeInput.addEventListener("input", updateGenerator);
levelsInput.addEventListener("input", updateGenerator);
document.querySelectorAll('input[name="ratio"]').forEach((input) => {
    input.addEventListener("change", updateGenerator);
});
copyButton.addEventListener("click", copyCss);

updateGenerator();
