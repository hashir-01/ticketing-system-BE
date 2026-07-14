import { Test, TestingModule } from '@nestjs/testing';
import { EmployeePerformanceController } from './employee-performance.controller';

describe('EmployeePerformanceController', () => {
  let controller: EmployeePerformanceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeePerformanceController],
    }).compile();

    controller = module.get<EmployeePerformanceController>(EmployeePerformanceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
