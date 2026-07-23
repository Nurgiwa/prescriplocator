// backend/algorithm/pharmacyRanker.js
// Ranks pharmacies after A* runs — drug availability first, then distance

function rankPharmacies(pharmacies) {
return pharmacies.sort((a, b) => {
// Pharmacies with all drugs come first
if (b.all_drugs_available !== a.all_drugs_available) {
return b.all_drugs_available - a.all_drugs_available;
}
// Then by drug availability count
if (b.drugs_available !== a.drugs_available) {
return b.drugs_available - a.drugs_available;
}
// Finally by road distance
return a.distance_km - b.distance_km;
});
}

module.exports = { rankPharmacies };