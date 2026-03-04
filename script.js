document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
        const faqItem = button.parentElement;
        const isActive = faqItem.classList.contains('active');

        // Opțional: închide celelalte panouri (dacă vrei să fie deschis doar unul singur)
        document.querySelectorAll('.faq-item').forEach(item => {
            item.classList.remove('active');
        });

        // Alternare stadiu panou curent
        if (!isActive) {
            faqItem.classList.add('active');
        }
    });
});
