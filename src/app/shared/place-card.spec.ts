import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CommonsPhoto, CommonsPhotoService } from '../core/commons-photo.service';
import { Place } from '../core/models';
import { PlaceCard } from './place-card';

const PLACE: Place = {
  id: 'node/1',
  name: 'Café Crave',
  named: true,
  location: { lat: 0, lng: 0 },
  kind: 'cafe',
  cuisines: ['coffee'],
  vegetarian: false,
  features: [],
  commonsFile: 'File:Cafe Crave.jpg',
  sourceUrl: 'https://www.openstreetmap.org/node/1',
};

describe('PlaceCard photo treatment', () => {
  let fixture: ComponentFixture<PlaceCard>;
  let currentPhoto: ReturnType<typeof signal<CommonsPhoto | null>>;
  let markUnavailable: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    currentPhoto = signal<CommonsPhoto | null>({
      thumbnailUrl: 'https://upload.wikimedia.org/example/cafe.jpg',
      filePageUrl: 'https://commons.wikimedia.org/wiki/File:Cafe_Crave.jpg',
      creator: 'Ada Photographer',
      license: 'CC BY-SA 4.0',
    });
    markUnavailable = vi.fn(() => currentPhoto.set(null));
    await TestBed.configureTestingModule({
      imports: [PlaceCard],
      providers: [
        {
          provide: CommonsPhotoService,
          useValue: {
            photoFor: () => currentPhoto.asReadonly(),
            markUnavailable,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PlaceCard);
    fixture.componentRef.setInput('place', PLACE);
    fixture.detectChanges();
  });

  it('shows an accessible Commons image and source link when one resolves', () => {
    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    const source = fixture.nativeElement.querySelector('.photo-source') as HTMLAnchorElement;

    expect(image.alt).toBe('Photo of Café Crave');
    expect(source.href).toBe('https://commons.wikimedia.org/wiki/File:Cafe_Crave.jpg');
    expect(source.textContent.trim()).toBe('Commons');
  });

  it('returns to the existing artwork if the image fails to load', () => {
    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(markUnavailable).toHaveBeenCalledWith('File:Cafe Crave.jpg');
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.foodimg').textContent).toContain('☕');
  });
});
