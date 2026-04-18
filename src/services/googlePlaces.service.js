const { BadRequestError } = require('../utils/errors');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACES_DETAIL_URL = 'https://places.googleapis.com/v1/places';

class GooglePlacesService {
  async autocomplete(input, { countryCode = 'MY' } = {}) {
    if (!input || input.length < 2) {
      throw new BadRequestError('Search input must be at least 2 characters');
    }

    if (!GOOGLE_MAPS_API_KEY) {
      throw new BadRequestError('Google Maps API key not configured');
    }

    const response = await fetch(PLACES_AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: [countryCode],
        languageCode: 'en',
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new BadRequestError(err.error?.message || 'Places autocomplete failed');
    }

    const data = await response.json();

    return (data.suggestions || []).map(s => ({
      place_id: s.placePrediction?.placeId,
      description: s.placePrediction?.text?.text,
    }));
  }

  async getPlaceDetails(placeId) {
    if (!placeId) {
      throw new BadRequestError('Place ID is required');
    }

    if (!GOOGLE_MAPS_API_KEY) {
      throw new BadRequestError('Google Maps API key not configured');
    }

    const url = `${PLACES_DETAIL_URL}/${placeId}`;
    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'displayName,formattedAddress,location,addressComponents',
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new BadRequestError(err.error?.message || 'Place details fetch failed');
    }

    const place = await response.json();

    // Parse address components
    const components = place.addressComponents || [];
    const getComponent = (type) => {
      const comp = components.find(c => c.types?.includes(type));
      return comp?.longText || '';
    };

    return {
      name: place.displayName?.text,
      address: place.formattedAddress,
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,
      // Parsed components for form auto-fill
      city: getComponent('locality') || getComponent('administrative_area_level_2'),
      state: getComponent('administrative_area_level_1'),
      postcode: getComponent('postal_code'),
      country: getComponent('country'),
    };
  }
}

module.exports = new GooglePlacesService();
