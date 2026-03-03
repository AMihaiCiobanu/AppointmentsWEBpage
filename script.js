// FAQ accordion
document.querySelectorAll(".faq-item").forEach(function (item) {
    var button = item.querySelector(".faq-question");
    button.addEventListener("click", function () {
        var isOpen = item.classList.contains("open");
        document.querySelectorAll(".faq-item.open").forEach(function (openItem) {
            if (openItem !== item) {
                openItem.classList.remove("open");
            }
        });
        if (!isOpen) {
            item.classList.add("open");
        } else {
            item.classList.remove("open");
        }
    });
});

// Set current year in footer
var yearSpan = document.getElementById("year-span");
if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
}

// Small UX polish: subtle hover parallax on screenshot cards (desktop only)
if (window.matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll(".screenshot-card").forEach(function (card) {
        card.addEventListener("mousemove", function (event) {
            var rect = card.getBoundingClientRect();
            var x = (event.clientX - rect.left) / rect.width - 0.5;
            var y = (event.clientY - rect.top) / rect.height - 0.5;
            card.style.transform =
                "translateY(-4px) rotateX(" + y * -4 + "deg) rotateY(" + x * 4 + "deg)";
        });

        card.addEventListener("mouseleave", function () {
            card.style.transform = "";
        });
    });
}

