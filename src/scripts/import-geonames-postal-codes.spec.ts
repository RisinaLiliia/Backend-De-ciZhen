import {
  mergePostalCodes,
  parseGeoNamesPostalLine,
  scorePostalCandidate,
  selectBestPostalCityCandidate,
  shouldIncludePostalRow,
} from './import-geonames-postal-codes';

describe('import-geonames-postal-codes', () => {
  it('parses GeoNames postal rows and normalizes postal codes', () => {
    const row = parseGeoNamesPostalLine('DE\t01067\tDresden\tSachsen\t13\t00\t\t\t\t51.05089\t13.73832\t6');

    expect(row).toEqual({
      countryCode: 'DE',
      postalCode: '01067',
      placeName: 'Dresden',
      normalizedPlaceName: 'dresden',
      adminName1: 'Sachsen',
      adminCode1: '13',
      adminName2: '00',
      adminCode2: '',
      adminName3: '',
      adminCode3: '',
      lat: 51.05089,
      lng: 13.73832,
      accuracy: '6',
    });
    expect(row && shouldIncludePostalRow(row)).toBe(true);
  });

  it('merges postal codes uniquely and in sorted order', () => {
    expect(mergePostalCodes(['80331', '10115'], ['01067', '80331', ' 01069 '])).toEqual([
      '01067',
      '01069',
      '10115',
      '80331',
    ]);
  });

  it('prefers same-state candidate for duplicate city names', () => {
    const row = parseGeoNamesPostalLine('DE\t01067\tDresden\tSachsen\t13\t00\t\t\t\t51.05089\t13.73832\t6');

    const saxonyCandidate = {
      _id: 'dresden-sax',
      name: 'Dresden',
      normalizedName: 'dresden',
      normalizedAliases: ['dresden'],
      countryCode: 'DE',
      stateCode: '13',
      stateName: 'Sachsen',
      districtName: '00',
      postalCodes: [],
      lat: 51.05089,
      lng: 13.73832,
      population: 556227,
    } as any;
    const northRhineCandidate = {
      _id: 'dresden-nrw',
      name: 'Dresden',
      normalizedName: 'dresden',
      normalizedAliases: ['dresden'],
      countryCode: 'DE',
      stateCode: '10',
      stateName: 'Nordrhein-Westfalen',
      districtName: '00',
      postalCodes: [],
      lat: 51.2,
      lng: 7.1,
      population: 1000,
    } as any;

    expect(scorePostalCandidate(saxonyCandidate, row!)).toBeGreaterThan(scorePostalCandidate(northRhineCandidate, row!));
    expect(selectBestPostalCityCandidate([northRhineCandidate, saxonyCandidate], row!)?._id).toBe('dresden-sax');
  });
});
