module.exports = class Utils {
  static convertRating(rating, minOriginal, maxOriginal) {
    const rangeOriginal = maxOriginal - minOriginal;

    const minNew = 1;
    const maxNew = 6;
    const rangeNew = maxNew - minNew;

    if (rating < minOriginal) {
      rating = minOriginal;
    } else if (rating > maxOriginal) {
      rating = maxOriginal;
    }
    const normalized = (rating - minOriginal) / rangeOriginal;
    const adjustedRating = normalized * rangeNew + minNew;
    return Math.round(adjustedRating * 10) / 10;
  }

  static mergeRatings(rating1, rating2, weight1 = 1, weight2 = 1) {
    const minScale = 1;
    const maxScale = 6;
    rating1 = Math.min(Math.max(rating1, minScale), maxScale);
    rating2 = Math.min(Math.max(rating2, minScale), maxScale);

    const totalWeight = weight1 + weight2;
    const weightedAverage =
      (rating1 * weight1 + rating2 * weight2) / totalWeight;
    const mergedRating = Math.round(weightedAverage * 10) / 10;

    return Math.min(Math.max(mergedRating, minScale), maxScale);
  }
};
