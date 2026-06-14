// Reservation fee and status color configuration
const MAX_RESERVATION_FEE = 5000;

const RES_COLORS = {
  ok:       { c:"#1A7F5A", bg:"#E6F4EE", border:"#A8D5BE" },
  warning:  { c:"#A06810", bg:"#FDF3DC", border:"#E8C97A" },
  critical: { c:"#B83232", bg:"#FAEAEA", border:"#F0BCBC" },
  expired:  { c:"#718096", bg:"#F7F9FC", border:"#CBD5E0" },
  inactive: { c:"#718096", bg:"#F7F9FC", border:"#CBD5E0" },
};

export { MAX_RESERVATION_FEE, RES_COLORS };
