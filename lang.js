const supported = ["en", "ru"];
const defaultLang = "en";

const urlParams = new URLSearchParams(window.location.search);
const urlLang = urlParams.get("lang");

const storedLang = localStorage.getItem("lang");

const browserLangs = navigator.languages || [navigator.language || defaultLang];
const hasRussianHigher =
    browserLangs.findIndex(l => l.startsWith("ru")) <
    browserLangs.findIndex(l => l.startsWith("en")) ||
    (browserLangs.some(l => l.startsWith("ru")) && !browserLangs.some(l => l.startsWith("en")));

let lang = defaultLang;
if (urlLang && supported.includes(urlLang)) {
    lang = urlLang;
} else if (storedLang && supported.includes(storedLang)) {
    lang = storedLang;
} else if (hasRussianHigher) {
    lang = "ru";
}

localStorage.setItem("lang", lang);
if (!urlLang) {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("lang", lang);
    window.history.replaceState({}, "", newUrl);
}

const translations = {
    en: {
        title: "Sea battle helper",
        tip: "Click a cell to toggle its state: unknown → miss → hit → sunk",
        analyze: "Analyze",
        reset: "Reset field",
        message: "Remaining: square 1, triangles 2, domino 3, mine 1"
    },
    ru: {
        title: "Морской бой хелпер",
        tip: "Клик по клетке переключает её состояние: не открыта → мимо → ранен → потоплен",
        analyze: "Анализ",
        reset: "Сбросить поле",
        message: "Осталось: квадрат 1, треугольники 2, домино 3, мина 1"
    }
};

document.querySelectorAll("[lang]").forEach(el => {
    const key = el.getAttribute("lang");
    const text = translations[lang]?.[key];
    if (text) el.textContent = text;
});