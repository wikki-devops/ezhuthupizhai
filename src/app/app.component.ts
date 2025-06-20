import { Component, Renderer2 } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'ezhuthupizhai';
  constructor(private renderer: Renderer2) { }
  ngAfterViewInit() {
    const script = this.renderer.createElement('script');
    script.type = 'text/javascript';
    script.src = 'assets/js/jquery.min.js';
    script.src = 'assets/vendor/wow/wow.min.js';
    script.src = 'assets/vendor/bootstrap/dist/js/bootstrap.bundle.min.js';
    script.src = 'assets/vendor/bootstrap-select/dist/js/bootstrap-select.min.js';
    script.src = 'assets/vendor/bootstrap-touchspin/bootstrap-touchspin.js';
    script.src = 'assets/vendor/swiper/swiper-bundle.min.js';
    script.src = 'assets/vendor/magnific-popup/magnific-popup.js';
    script.src = 'assets/vendor/imagesloaded/imagesloaded.js';
    script.src = 'assets/vendor/masonry/masonry-4.2.2.js';
    script.src = 'assets/vendor/masonry/isotope.pkgd.min.js';
    script.src = 'assets/vendor/countdown/jquery.countdown.js';
    script.src = 'assets/vendor/wnumb/wNumb.js';
    script.src = 'assets/vendor/nouislider/nouislider.min.js';
    script.src = 'assets/vendor/slick/slick.min.js';
    script.src = 'assets/vendor/lightgallery/dist/lightgallery.min.js';
    script.src = 'assets/vendor/lightgallery/dist/plugins/thumbnail/lg-thumbnail.min.js';
    script.src = 'assets/vendor/lightgallery/dist/plugins/zoom/lg-zoom.min.js';
    script.src = 'assets/js/dz.carousel.js';
    script.src = 'assets/js/dz.ajax.js';
    script.src = 'assets/js/custom.min.js';

    this.renderer.appendChild(document.body, script);
  }

}
