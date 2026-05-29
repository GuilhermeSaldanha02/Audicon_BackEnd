import { ForbiddenException } from '@nestjs/common';
import { assertTenantScope } from './assert-tenant-scope';

describe('assertTenantScope', () => {
  it('user undefined → 403', () => {
    expect(() => assertTenantScope(undefined)).toThrow(ForbiddenException);
  });

  it('user null → 403', () => {
    expect(() => assertTenantScope(null)).toThrow(ForbiddenException);
  });

  it('non-master sem companyId → 403 (defesa contra estado inválido)', () => {
    expect(() =>
      assertTenantScope({ isMaster: false, companyId: null }),
    ).toThrow(ForbiddenException);
  });

  it('non-master com companyId undefined → 403', () => {
    expect(() => assertTenantScope({ isMaster: false })).toThrow(
      ForbiddenException,
    );
  });

  it('non-master com companyId = 0 → 403', () => {
    expect(() => assertTenantScope({ isMaster: false, companyId: 0 })).toThrow(
      ForbiddenException,
    );
  });

  it('non-master com companyId válido → { companyId, isMaster: false }', () => {
    expect(assertTenantScope({ isMaster: false, companyId: 7 })).toEqual({
      companyId: 7,
      isMaster: false,
    });
  });

  it('master sem override → { companyId: null, isMaster: true }', () => {
    expect(assertTenantScope({ isMaster: true, companyId: null })).toEqual({
      companyId: null,
      isMaster: true,
    });
  });

  it('master com override válido → { companyId: override, isMaster: true }', () => {
    expect(
      assertTenantScope(
        { isMaster: true, companyId: null },
        { masterOverrideCompanyId: 5 },
      ),
    ).toEqual({ companyId: 5, isMaster: true });
  });

  it('master com override 0 → trata como sem override (companyId: null)', () => {
    expect(
      assertTenantScope(
        { isMaster: true, companyId: null },
        { masterOverrideCompanyId: 0 },
      ),
    ).toEqual({ companyId: null, isMaster: true });
  });

  it('master com override null → companyId: null (vê tudo)', () => {
    expect(
      assertTenantScope(
        { isMaster: true, companyId: null },
        { masterOverrideCompanyId: null },
      ),
    ).toEqual({ companyId: null, isMaster: true });
  });
});
