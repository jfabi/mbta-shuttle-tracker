/*
Written by Joshua Fabian
jfabi@alum.mit.edu
https://github.com/jfabi/mbta-shuttle-tracker
*/

REAL_TIME_SHUTTLE_ROUTES = 'Shuttle-Generic-Blue,Shuttle-Generic-Red,Shuttle-Generic-Orange,Shuttle-Generic-Green,Shuttle-Generic-CommuterRail,Shuttle-Generic';

var apiURL = 'https://api-v3.mbta.com';
var displayLabelTooltips = false;
var labelTooltipOpacity = 0.9;
var vehicleArray = [];
var currentMarkers = []

var iconBus = L.icon({
    iconUrl: 'icons/bus.svg',
    iconSize: [25, 25],
    popupAnchor: [-3, -6],
});

var iconBL = L.icon({
    iconUrl: 'icons/BL.svg',
    iconSize: [25, 25],
    popupAnchor: [-3, -6],
});

var iconRL = L.icon({
    iconUrl: 'icons/RL.svg',
    iconSize: [25, 25],
    popupAnchor: [-3, -6],
});

var iconOL = L.icon({
    iconUrl: 'icons/OL.svg',
    iconSize: [25, 25],
    popupAnchor: [-3, -6],
});

var iconGL = L.icon({
    iconUrl: 'icons/GL.svg',
    iconSize: [25, 25],
    popupAnchor: [-3, -6],
});

var iconML = L.icon({
    iconUrl: 'icons/ML.svg',
    iconSize: [15, 15],
    popupAnchor: [-3, -6],
});

var iconCR = L.icon({
    iconUrl: 'icons/CR.svg',
    iconSize: [25, 25],
    popupAnchor: [-3, -6],
});

// Initialize the map

var layer = new L.StamenTileLayer('toner');
layer = layer.setOpacity(0.75);
var map = L.map('map').setView([42.35, -71.08], 13);
map.addLayer(layer);

// Get all MBTA rail and ferry routes

var allNonBusRoutes = [];
var allNonBusRoutesString = '';
jQuery(document).ready(function($) {
    $.ajax({
        url: apiURL + '/routes?filter[type]=0,1,2,4',
        dataType: 'json',
        async: false,
        success: function(parsedJson) {
            let jsonData = parsedJson['data'];
            for (j = 0; j < jsonData.length; j++) {
                allNonBusRoutes.push(jsonData[j]['id']);
            }
            allNonBusRoutesString = allNonBusRoutes.join();
        }
    });
});

// Get the set of routes related to MBTA rail and ferry routes, which will included scheduled shuttle bus routess

var allShuttleRoutes = new Set();
var allShuttleRoutesString = '';
jQuery(document).ready(function($) {
    $.ajax({
        url: apiURL + '/route_patterns?filter[route]=' + allNonBusRoutesString,
        dataType: 'json',
        async: false,
        success: function(parsedJson) {
            let jsonData = parsedJson['data'];
            for (j = 0; j < jsonData.length; j++) {
                if (!allNonBusRoutes.includes(jsonData[j]['relationships']['route']['data']['id'])) {
                    allShuttleRoutes.add(jsonData[j]['relationships']['route']['data']['id']);
                }
            }
            allShuttleRoutesString = [...allShuttleRoutes].join();
        }
    });
});

// Determine which shuttle bus routes are scheduled for operation today

var activeShuttleRoutes = new Set();
var activeShuttleRoutesString = '';
jQuery(document).ready(function($) {
    $.ajax({
        url: apiURL + '/schedules?filter[stop_sequence]=first&filter[route]=' + allShuttleRoutesString,
        dataType: 'json',
        async: false,
        success: function(parsedJson) {
            let jsonData = parsedJson['data'];
            for (j = 0; j < jsonData.length; j++) {
                activeShuttleRoutes.add(jsonData[j]['relationships']['route']['data']['id']);
            }
            activeShuttleRoutesString = [...activeShuttleRoutes].join();
        }
    });
});

// Store all shapes related to actively-scheduled shuttle bus routes

jQuery(document).ready(function($) {
    $.ajax({
        url: apiURL + '/shapes?filter[route]=' + activeShuttleRoutesString,
        dataType: 'json',
        async: false,
        success: function(parsedJson) {
            let jsonData = parsedJson['data'];
            for (j = 0; j < jsonData.length; j++) {
                let shapeId = jsonData[j]['id'];
                let shapePolyline = jsonData[j]['attributes']['polyline'];
                let shapeCoordinates = L.Polyline.fromEncoded(shapePolyline).getLatLngs();
                // let shapeRoute = jsonData[j]['relationships']['route']['data']['id'];

                var polyline = L.polyline(shapeCoordinates, {
                    weight: 4,
                    color: '#0000FF',
                });
                polyline.addTo(map);
                polyline.bindTooltip(shapeId, {
                    permanent: displayLabelTooltips,
                    sticky: true,
                    className: 'shuttleShape',
                });
            }
        }
    });
});

// Get updated vehicle locations and display on map

function updateVehicles() {
    setTimeout(function() {
        vehicleArray = [];
        jQuery(document).ready(function($) {
            $.ajax({
                url: apiURL + '/vehicles?filter[route]=' + REAL_TIME_SHUTTLE_ROUTES,
                dataType: 'json',
                async: false,
                success: function(parsedJson) {
                    let jsonData = parsedJson['data'];
                    for (j = 0; j < jsonData.length; j++) {
                        let vehicleId = jsonData[j]['id'];
                        let vehicleLabel = '' + jsonData[j]['attributes']['label'];
                        let vehicleLat = jsonData[j]['attributes']['latitude'];
                        let vehicleLon = jsonData[j]['attributes']['longitude'];
                        let vehicleBearing = jsonData[j]['attributes']['bearing'];
                        let vehicleRoute = '' + jsonData[j]['relationships']['route']['data']['id'];
                        let vehicleTimestamp = jsonData[j]['attributes']['updated_at'];
                        let vehicleOccupancy = jsonData[j]['attributes']['occupancy_status'];
                        newVehicle = {
                            vehicleId: vehicleId,
                            vehicleLabel: vehicleLabel,
                            vehicleLat: vehicleLat,
                            vehicleLon: vehicleLon,
                            vehicleBearing: vehicleBearing,
                            vehicleRoute: vehicleRoute,
                            vehicleOperator: 'MBTA',
                            vehicleTimestamp: vehicleTimestamp,
                            vehicleOccupancy: vehicleOccupancy,
                        };
                        vehicleArray.push(newVehicle)
                    }
                }
            });
        });

        if (vehicleArray.length > 0) {
            for (j = 0; j < currentMarkers.length; j++) {
                map.removeLayer(currentMarkers[j]);
            }
            currentMarkers = [];

            // Draw newly-updated vehicles on map

            for (j = 0; j < vehicleArray.length; j++) {
                if (vehicleArray[j]['vehicleLat'] != null) {
                    var vehicleLabel = '<span style="font-size: 16px"><b>' + vehicleArray[j]['vehicleLabel'] + '</b></span>';
                    var vehicleOperator = vehicleArray[j]['vehicleOperator'];
                    var vehicleRoute = vehicleArray[j]['vehicleRoute'];
                    var vehicleBearingLabel = bearingToLabel(vehicleArray[j]['vehicleBearing'])
                    var lastUpdated = vehicleArray[j]['vehicleTimestamp'];
                    var vehicleOccupancy = vehicleArray[j]['vehicleOccupancy'];
                    var popupText = vehicleLabel
                        + '<br>Operator: <b>' + vehicleOperator + '</b>'
                        + '<br>Route: <b>' + vehicleRoute + '</b>'
                        + '<br>Direction: <b>' + vehicleBearingLabel + '</b>'
                        + '<br>Crowding: <b>' + vehicleOccupancy + '</b>'
                        + '<br>Updated at: <b>' + lastUpdated + '</b>';

                    var markerIcon = iconBus;
                    if (vehicleArray[j]['vehicleRoute'] == 'Shuttle-Generic-Red') {
                        markerIcon = iconRL;
                    } else if (vehicleArray[j]['vehicleRoute'] == 'Shuttle-Generic-Blue') {
                        markerIcon = iconBL;
                    } else if (vehicleArray[j]['vehicleRoute'] == 'Shuttle-Generic-Orange') {
                        markerIcon = iconOL;
                    } else if (vehicleArray[j]['vehicleRoute'] == 'Shuttle-Generic-Green') {
                        markerIcon = iconGL;
                    } else if (vehicleArray[j]['vehicleRoute'] == 'Shuttle-Generic-CommuterRail') {
                        markerIcon = iconCR;
                    }

                    var marker = L.marker([vehicleArray[j]['vehicleLat'], vehicleArray[j]['vehicleLon']], {icon: markerIcon}).addTo(map);
                    marker.bindTooltip(vehicleArray[j]['vehicleLabel'], {
                        permanent: displayLabelTooltips,
                        opacity: labelTooltipOpacity,
                        offset: L.point(10, 0),
                        direction: 'right'
                    });
                    currentMarkers.push(marker);
                    marker.bindPopup(popupText, {autoPan: false});
                }
            }
        }
    }, 100);
};

// Refresh vehicle locations upon page load and then every 15 seconds

setInterval(updateVehicles, 15000);
updateVehicles();

// Helper functions

function toggleLabels(checkboxElement) {
    if (checkboxElement.checked) {
        displayLabelTooltips = true;
        labelTooltipOpacity = 0.6;
        updateVehicles();
    } else {
        displayLabelTooltips = false;
        labelTooltipOpacity = 0.9;
        updateVehicles();
    }
};

function toggleShapes(checkboxElement) {
    if (checkboxElement.checked) {
        document.querySelectorAll('path').forEach(function(element) {
           element.style.display = 'block';
        });
    } else {
        document.querySelectorAll('path').forEach(function(element) {
           element.style.display = 'none';
        });
    }
};

function toggleMoreInfo() {
    let infoDisclaimer = document.getElementById('infoDisclaimer')
    if (infoDisclaimer.style.display == 'none') {
        infoDisclaimer.style.display = 'block';
        document.getElementById('linkInfoDisclaimer').innerText = 'Hide this info';
    } else {
        infoDisclaimer.style.display = 'none';
        document.getElementById('linkInfoDisclaimer').innerText = 'Learn more about this data';
    }
};

function bearingToLabel(bearing) {
    if (bearing >=0 && bearing < 22.5) {
        return 'North';
    } else if (bearing >= 22.5 && bearing < 67.5) {
        return 'Northeast';
    } else if (bearing >= 67.5 && bearing < 112.5) {
        return 'East';
    } else if (bearing >= 112.5 && bearing < 157.5) {
        return 'Southeast';
    } else if (bearing >= 157.5 && bearing < 202.5) {
        return 'South';
    } else if (bearing >= 202.5 && bearing < 247.5) {
        return 'Southwest';
    } else if (bearing >= 247.5 && bearing < 292.5) {
        return 'West';
    } else if (bearing >= 292.5 && bearing < 337.5) {
        return 'Northwest';
    } else {
        return 'North';
    }
};
