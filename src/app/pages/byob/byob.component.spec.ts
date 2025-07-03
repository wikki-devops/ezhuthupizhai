import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ByobComponent } from './byob.component';

describe('ByobComponent', () => {
  let component: ByobComponent;
  let fixture: ComponentFixture<ByobComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ByobComponent]
    });
    fixture = TestBed.createComponent(ByobComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
