/**
 * Cricket Auction System - Main JavaScript File
 */

document.addEventListener('DOMContentLoaded', function() {
  // Enable Bootstrap tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function(tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
  
  // Enable Bootstrap popovers
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  popoverTriggerList.map(function(popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });
  
  // Add animation classes to elements when they enter the viewport
  const animateElements = document.querySelectorAll('.animate-on-scroll');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fadeIn');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1
  });
  
  animateElements.forEach(element => {
    observer.observe(element);
  });
  
  // Format currency values
  const currencyElements = document.querySelectorAll('.format-currency');
  currencyElements.forEach(element => {
    const value = parseInt(element.textContent.replace(/[^0-9]/g, ''));
    if (!isNaN(value)) {
      element.textContent = value.toLocaleString();
    }
  });
  
  // Mobile menu toggle
  const mobileMenuButton = document.querySelector('.navbar-toggler');
  if (mobileMenuButton) {
    mobileMenuButton.addEventListener('click', function() {
      document.body.classList.toggle('mobile-menu-open');
    });
  }
  
  // Form validation
  const forms = document.querySelectorAll('.needs-validation');
  Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      form.classList.add('was-validated');
    }, false);
  });
  
  // Countdown timer for auctions
  const countdownElements = document.querySelectorAll('.countdown-timer');
  countdownElements.forEach(element => {
    const targetTime = new Date(element.dataset.targetTime).getTime();
    
    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = targetTime - now;
      
      if (distance < 0) {
        element.textContent = "Auction Ended";
        return;
      }
      
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      
      element.textContent = `${minutes}m ${seconds}s`;
    };
    
    // Update immediately and then every second
    updateCountdown();
    setInterval(updateCountdown, 1000);
  });
  
  // Add smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
});