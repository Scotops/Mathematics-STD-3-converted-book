/* Prevent an orphaned Submit button when a page has no answer controls. */
document.querySelectorAll('[data-section-type="activity_open_ended_answer"]').forEach((section) => {
  if (!section.querySelector('input, textarea, select, [contenteditable="true"]')) {
    section.dataset.sectionType = 'text';
  }
});
