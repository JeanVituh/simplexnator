import { br, dec, fmtNum, point, rel, sub } from '@/lib/format'

describe('format', () => {
  it('usa vírgula decimal e arredonda para 4 casas', () => {
    expect(dec(5.25)).toBe('5,25'); expect(dec(-0.00001)).toBe('0'); expect(dec(1 / 3)).toBe('0,3333'); expect(dec(7)).toBe('7')
  })
  it('converte decimais do backend e preserva frações', () => {
    expect(br('-0.5M+0.4')).toBe('-0,5M+0,4'); expect(br('15/2')).toBe('15/2')
  })
  it('alterna entre fração exata e decimal', () => {
    const n = { value: 7.5, frac: '15/2' }
    expect(fmtNum(n, true)).toBe('15/2'); expect(fmtNum(n, false)).toBe('7,5'); expect(fmtNum(null, false)).toBe('—')
    expect(point([n, { value: 4.5, frac: '9/2' }], false)).toBe('(7,5; 4,5)')
  })
  it('símbolos e subscritos', () => { expect(rel('<=')).toBe('≤'); expect(rel('>=')).toBe('≥'); expect(rel('=')).toBe('='); expect(sub('x12')).toBe('x₁₂') })
})
