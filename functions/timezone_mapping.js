// Timezone mapping based on existing states_by_country.dart data
// This provides a more maintainable and comprehensive timezone system

const timezoneMapping = {
  'United States': {
    // Eastern Time Zone
    'Connecticut': 'America/New_York',
    'Delaware': 'America/New_York',
    'District of Columbia': 'America/New_York',
    'Florida': 'America/New_York',
    'Georgia': 'America/New_York',
    'Maine': 'America/New_York',
    'Maryland': 'America/New_York',
    'Massachusetts': 'America/New_York',
    'New Hampshire': 'America/New_York',
    'New Jersey': 'America/New_York',
    'New York': 'America/New_York',
    'North Carolina': 'America/New_York',
    'Ohio': 'America/New_York',
    'Pennsylvania': 'America/New_York',
    'Rhode Island': 'America/New_York',
    'South Carolina': 'America/New_York',
    'Vermont': 'America/New_York',
    'Virginia': 'America/New_York',
    'West Virginia': 'America/New_York',
    'Michigan': 'America/New_York',
    'Indiana': 'America/New_York',
    'Kentucky': 'America/New_York',
    
    // Central Time Zone
    'Alabama': 'America/Chicago',
    'Arkansas': 'America/Chicago',
    'Illinois': 'America/Chicago',
    'Iowa': 'America/Chicago',
    'Kansas': 'America/Chicago',
    'Louisiana': 'America/Chicago',
    'Minnesota': 'America/Chicago',
    'Mississippi': 'America/Chicago',
    'Missouri': 'America/Chicago',
    'Nebraska': 'America/Chicago',
    'North Dakota': 'America/Chicago',
    'Oklahoma': 'America/Chicago',
    'South Dakota': 'America/Chicago',
    'Tennessee': 'America/Chicago',
    'Texas': 'America/Chicago',
    'Wisconsin': 'America/Chicago',
    
    // Mountain Time Zone
    'Arizona': 'America/Phoenix', // Arizona doesn't observe DST
    'Colorado': 'America/Denver',
    'Idaho': 'America/Boise',
    'Montana': 'America/Denver',
    'Nevada': 'America/Los_Angeles', // Most of Nevada is Pacific
    'New Mexico': 'America/Denver',
    'Utah': 'America/Denver',
    'Wyoming': 'America/Denver',
    
    // Pacific Time Zone
    'California': 'America/Los_Angeles',
    'Oregon': 'America/Los_Angeles',
    'Washington': 'America/Los_Angeles',
    
    // Special Cases
    'Alaska': 'America/Anchorage',
    'Hawaii': 'Pacific/Honolulu',
    'Puerto Rico': 'America/Puerto_Rico',
    'Virgin Islands': 'America/St_Thomas'
  },
  
  'Canada': {
    // Pacific Time Zone
    'British Columbia': 'America/Vancouver',
    'Yukon': 'America/Whitehorse',
    
    // Mountain Time Zone
    'Alberta': 'America/Edmonton',
    'Northwest Territories': 'America/Yellowknife',
    'Saskatchewan': 'America/Regina', // Saskatchewan doesn't observe DST
    
    // Central Time Zone
    'Manitoba': 'America/Winnipeg',
    'Nunavut': 'America/Iqaluit',
    
    // Eastern Time Zone
    'Ontario': 'America/Toronto',
    'Quebec': 'America/Montreal',
    
    // Atlantic Time Zone
    'New Brunswick': 'America/Moncton',
    'Nova Scotia': 'America/Halifax',
    'Prince Edward Island': 'America/Halifax',
    
    // Newfoundland Time Zone
    'Newfoundland and Labrador': 'America/St_Johns'
  },
  
  'Australia': {
    'Western Australia': 'Australia/Perth',
    'Northern Territory': 'Australia/Darwin',
    'South Australia': 'Australia/Adelaide',
    'Queensland': 'Australia/Brisbane',
    'New South Wales': 'Australia/Sydney',
    'Victoria': 'Australia/Melbourne',
    'Tasmania': 'Australia/Hobart',
    'Australian Capital Territory': 'Australia/Canberra'
  },
  
  // Single timezone countries
  'United Kingdom': 'Europe/London',
  'Germany': 'Europe/Berlin',
  'France': 'Europe/Paris',
  'Italy': 'Europe/Rome',
  'Spain': 'Europe/Madrid',
  'Netherlands': 'Europe/Amsterdam',
  'Belgium': 'Europe/Brussels',
  'Switzerland': 'Europe/Zurich',
  'Austria': 'Europe/Vienna',
  'Sweden': 'Europe/Stockholm',
  'Norway': 'Europe/Oslo',
  'Denmark': 'Europe/Copenhagen',
  'Finland': 'Europe/Helsinki',
  'Poland': 'Europe/Warsaw',
  'Czech Republic': 'Europe/Prague',
  'Hungary': 'Europe/Budapest',
  'Portugal': 'Europe/Lisbon',
  'Greece': 'Europe/Athens',
  'Turkey': 'Europe/Istanbul',
  'Russia': 'Europe/Moscow',
  'Japan': 'Asia/Tokyo',
  'China': 'Asia/Shanghai',
  'India': 'Asia/Kolkata',
  'Singapore': 'Asia/Singapore',
  'South Korea': 'Asia/Seoul',
  'Thailand': 'Asia/Bangkok',
  'Malaysia': 'Asia/Kuala_Lumpur',
  'Philippines': 'Asia/Manila',
  'Indonesia': 'Asia/Jakarta',
  'Vietnam': 'Asia/Ho_Chi_Minh',
  'Hong Kong': 'Asia/Hong_Kong',
  'Taiwan': 'Asia/Taipei',
  'Israel': 'Asia/Jerusalem',
  'United Arab Emirates': 'Asia/Dubai',
  'Saudi Arabia': 'Asia/Riyadh',
  'South Africa': 'Africa/Johannesburg',
  'Egypt': 'Africa/Cairo',
  'Nigeria': 'Africa/Lagos',
  'Kenya': 'Africa/Nairobi',
  'Morocco': 'Africa/Casablanca',
  'Brazil': 'America/Sao_Paulo',
  'Mexico': 'America/Mexico_City',
  'Argentina': 'America/Argentina/Buenos_Aires',
  'Chile': 'America/Santiago',
  'Colombia': 'America/Bogota',
  'Peru': 'America/Lima',
  'Venezuela': 'America/Caracas',
  'Ecuador': 'America/Guayaquil',
  'Uruguay': 'America/Montevideo',
  'Paraguay': 'America/Asuncion',
  'Bolivia': 'America/La_Paz',
  'New Zealand': 'Pacific/Auckland'
};

/**
 * Get timezone for a given country and state/province
 * @param {string} country - Country name
 * @param {string} state - State/province name (optional)
 * @returns {string} - IANA timezone identifier
 */
function getTimezoneFromLocation(country, state) {
  if (!country) return 'UTC';
  
  const countryTimezones = timezoneMapping[country];
  if (!countryTimezones) return 'UTC';
  
  // If country has multiple timezones and state is provided
  if (typeof countryTimezones === 'object' && state) {
    const stateTimezone = countryTimezones[state];
    if (stateTimezone) return stateTimezone;
    
    // If state not found, return first timezone for the country
    return Object.values(countryTimezones)[0] || 'UTC';
  }
  
  // If country has single timezone
  if (typeof countryTimezones === 'string') {
    return countryTimezones;
  }
  
  // If country has multiple timezones but no state provided, return first one
  if (typeof countryTimezones === 'object') {
    return Object.values(countryTimezones)[0] || 'UTC';
  }
  
  return 'UTC';
}

/**
 * Get all timezones that are currently at a specific hour (in 24-hour format)
 * @param {number} targetHour - Target hour (0-23)
 * @returns {Array<string>} - Array of timezone identifiers
 */
function getTimezonesAtHour(targetHour) {
  const now = new Date();
  const timezones = [];
  
  // Get unique timezones from our mapping
  const uniqueTimezones = new Set();
  
  Object.values(timezoneMapping).forEach(countryData => {
    if (typeof countryData === 'string') {
      uniqueTimezones.add(countryData);
    } else if (typeof countryData === 'object') {
      Object.values(countryData).forEach(tz => uniqueTimezones.add(tz));
    }
  });
  
  // Check which timezones are at the target hour
  uniqueTimezones.forEach(timezone => {
    try {
      const localTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
      if (localTime.getHours() === targetHour) {
        timezones.push(timezone);
      }
    } catch (error) {
      console.warn(`Invalid timezone: ${timezone}`);
    }
  });
  
  return timezones;
}

module.exports = {
  getTimezoneFromLocation,
  getTimezonesAtHour,
  timezoneMapping
};
