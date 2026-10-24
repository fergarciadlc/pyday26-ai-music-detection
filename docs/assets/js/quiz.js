// Quiz: reveal the answer of each clip, or all at once.
(function () {
  const LABEL = { human: "Humana", ai: "IA", hybrid: "Híbrida" };

  function reveal(clip) {
    const answer = clip.querySelector(".pd-answer");
    const button = clip.querySelector(".pd-reveal");
    if (!answer || !answer.hidden) return;
    answer.hidden = false;
    clip.classList.add("is-revealed", `is-${clip.dataset.answer}`);
    button.textContent = LABEL[clip.dataset.answer] || "Revelada";
    button.disabled = true;
  }

  function init() {
    const quiz = document.querySelector(".pd-quiz");
    if (!quiz) return;
    quiz.querySelectorAll(".pd-clip").forEach((clip) => {
      clip.querySelector(".pd-reveal").addEventListener("click", () => reveal(clip));
    });
    const all = document.querySelector(".pd-reveal-all");
    if (all) {
      all.addEventListener("click", () => {
        quiz.querySelectorAll(".pd-clip").forEach(reveal);
        all.disabled = true;
      });
    }
    // Only one clip plays at a time.
    quiz.addEventListener("play", (e) => {
      quiz.querySelectorAll("audio").forEach((a) => a !== e.target && a.pause());
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
