import { TestBed } from '@angular/core/testing';

import { ByobService } from './byob.service';

describe('ByobService', () => {
  let service: ByobService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ByobService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
