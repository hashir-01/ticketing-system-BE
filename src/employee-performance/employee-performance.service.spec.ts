import { Test, TestingModule } from '@nestjs/testing';
import { EmployeePerformanceService } from './employee-performance.service';

describe('EmployeePerformanceService', () => {
  let service: EmployeePerformanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmployeePerformanceService],
    }).compile();

    service = module.get<EmployeePerformanceService>(EmployeePerformanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
