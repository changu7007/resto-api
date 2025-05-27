"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fuzzySearch = void 0;
// Helper function for fuzzy search
const fuzzySearch = (text, searchTerm) => {
    // Convert both strings to lowercase for case-insensitive comparison
    text = text.toLowerCase();
    searchTerm = searchTerm.toLowerCase();
    // Split search term into words for better matching
    const searchWords = searchTerm.split(/\s+/);
    // Check if any word in the search term matches
    return searchWords.some((word) => {
        // Handle typos by allowing character distance
        const maxDistance = Math.floor(word.length * 0.3); // Allow 30% difference
        let found = false;
        // Check each position in the text
        for (let i = 0; i <= text.length - word.length; i++) {
            const substring = text.substr(i, word.length);
            let distance = 0;
            // Calculate Levenshtein distance
            for (let j = 0; j < word.length; j++) {
                if (word[j] !== substring[j])
                    distance++;
            }
            if (distance <= maxDistance) {
                found = true;
                break;
            }
        }
        return found;
    });
};
exports.fuzzySearch = fuzzySearch;
