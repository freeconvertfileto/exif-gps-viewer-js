(function () {
    'use strict';

    var dropZone = document.getElementById('egvDropZone');
    var selectBtn = document.getElementById('egvSelectBtn');
    var fileInput = document.getElementById('egvFileInput');
    var resultDiv = document.getElementById('egvResult');
    var noGpsDiv = document.getElementById('egvNoGps');
    var preview = document.getElementById('egvPreview');
    var latEl = document.getElementById('egvLat');
    var lngEl = document.getElementById('egvLng');
    var altEl = document.getElementById('egvAlt');
    var mapLink = document.getElementById('egvMapLink');
    var exifTable = document.getElementById('egvExifTable');
    var resetBtn = document.getElementById('egvResetBtn');
    var resetBtn2 = document.getElementById('egvResetBtn2');

    selectBtn.addEventListener('click', function () { fileInput.click(); });

    fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files[0]) {
            processFile(fileInput.files[0]);
        }
    });

    dropZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', function () {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        var file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            processFile(file);
        }
    });

    function processFile(file) {
        preview.src = URL.createObjectURL(file);
        var reader = new FileReader();
        reader.onload = function (e) {
            var buffer = e.target.result;
            var exif = parseExif(buffer);
            dropZone.style.display = 'none';

            if (exif && Object.keys(exif).length > 0) {
                populateTable(exif);
                var gps = exif.GPS || {};
                var lat = gpsToDecimal(gps.GPSLatitude, gps.GPSLatitudeRef);
                var lng = gpsToDecimal(gps.GPSLongitude, gps.GPSLongitudeRef);

                latEl.textContent = lat !== null ? lat.toFixed(6) : '-';
                lngEl.textContent = lng !== null ? lng.toFixed(6) : '-';
                altEl.textContent = gps.GPSAltitude ? gps.GPSAltitude.toFixed(1) + ' m' : '-';

                if (lat !== null && lng !== null) {
                    mapLink.href = 'https://www.google.com/maps?q=' + lat + ',' + lng;
                    mapLink.style.display = 'inline-block';
                } else {
                    mapLink.style.display = 'none';
                }

                resultDiv.style.display = 'block';
                noGpsDiv.style.display = 'none';
            } else {
                resultDiv.style.display = 'none';
                noGpsDiv.style.display = 'block';
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function gpsToDecimal(coords, ref) {
        if (!coords || !Array.isArray(coords) || coords.length < 3) return null;
        var d = coords[0] + coords[1] / 60 + coords[2] / 3600;
        if (ref === 'S' || ref === 'W') d = -d;
        return d;
    }

    function populateTable(exif) {
        exifTable.innerHTML = '';
        var flat = flattenExif(exif);
        flat.forEach(function (item) {
            var tr = document.createElement('tr');
            tr.innerHTML = '<td>' + escapeHtml(item.key) + '</td><td>' + escapeHtml(String(item.value)) + '</td>';
            exifTable.appendChild(tr);
        });
    }

    function flattenExif(obj, prefix) {
        var result = [];
        prefix = prefix || '';
        Object.keys(obj).forEach(function (k) {
            var val = obj[k];
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                result = result.concat(flattenExif(val, k + '.'));
            } else {
                result.push({ key: prefix + k, value: Array.isArray(val) ? val.join(', ') : val });
            }
        });
        return result;
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function resetTool() {
        fileInput.value = '';
        if (preview.src && preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
        preview.src = '';
        exifTable.innerHTML = '';
        latEl.textContent = '-';
        lngEl.textContent = '-';
        altEl.textContent = '-';
        mapLink.style.display = 'none';
        resultDiv.style.display = 'none';
        noGpsDiv.style.display = 'none';
        dropZone.style.display = 'flex';
    }

    resetBtn.addEventListener('click', resetTool);
    resetBtn2.addEventListener('click', resetTool);

    // Minimal EXIF binary parser
    function parseExif(buffer) {
        var data = new DataView(buffer);
        if (data.getUint16(0) !== 0xFFD8) return null;

        var offset = 2;
        var exif = {};

        while (offset < data.byteLength - 1) {
            var marker = data.getUint16(offset);
            offset += 2;
            if (marker === 0xFFE1) {
                // APP1 - EXIF
                var length = data.getUint16(offset);
                var exifData = new DataView(buffer, offset + 2, length - 2);
                if (getString(exifData, 0, 4) === 'Exif') {
                    exif = readTiffData(exifData, 6, buffer, offset + 2);
                }
                break;
            } else if ((marker & 0xFF00) === 0xFF00) {
                offset += data.getUint16(offset);
            } else {
                break;
            }
        }
        return exif;
    }

    function getString(view, offset, len) {
        var s = '';
        for (var i = 0; i < len; i++) {
            s += String.fromCharCode(view.getUint8(offset + i));
        }
        return s;
    }

    function readTiffData(view, tiffOffset, origBuffer, app1Offset) {
        var result = {};
        var littleEndian = view.getUint16(tiffOffset) === 0x4949;
        var ifdOffset = view.getUint32(tiffOffset + 4, littleEndian);

        function readIFD(offset) {
            var entries = view.getUint16(tiffOffset + offset, littleEndian);
            var ifd = {};
            for (var i = 0; i < entries; i++) {
                var entryOffset = tiffOffset + offset + 2 + i * 12;
                var tag = view.getUint16(entryOffset, littleEndian);
                var type = view.getUint16(entryOffset + 2, littleEndian);
                var count = view.getUint32(entryOffset + 4, littleEndian);
                var valueOffset = entryOffset + 8;
                var tagName = TAGS[tag] || ('Tag_' + tag.toString(16));
                var value = readValue(view, type, count, valueOffset, tiffOffset, littleEndian);
                if (tag === 0x8825) {
                    ifd['GPS'] = readIFD(view.getUint32(valueOffset, littleEndian));
                } else if (tag === 0x8769) {
                    var exifSub = readIFD(view.getUint32(valueOffset, littleEndian));
                    Object.keys(exifSub).forEach(function (k) { ifd[k] = exifSub[k]; });
                } else {
                    ifd[tagName] = value;
                }
            }
            return ifd;
        }

        return readIFD(ifdOffset);
    }

    function readValue(view, type, count, valueOffset, tiffOffset, le) {
        var byteSize = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
        var size = byteSize[type] || 1;
        var dataOffset = (size * count > 4) ? (tiffOffset + view.getUint32(valueOffset, le)) : valueOffset;

        if (type === 2) {
            var str = '';
            for (var i = 0; i < count - 1; i++) {
                var c = view.getUint8(dataOffset + i);
                if (c === 0) break;
                str += String.fromCharCode(c);
            }
            return str;
        }
        if (type === 5 || type === 10) {
            // Rational
            var vals = [];
            for (var j = 0; j < count; j++) {
                var num = (type === 5)
                    ? view.getUint32(dataOffset + j * 8, le)
                    : view.getInt32(dataOffset + j * 8, le);
                var den = (type === 5)
                    ? view.getUint32(dataOffset + j * 8 + 4, le)
                    : view.getInt32(dataOffset + j * 8 + 4, le);
                vals.push(den !== 0 ? num / den : 0);
            }
            return count === 1 ? vals[0] : vals;
        }
        if (type === 3) return view.getUint16(dataOffset, le);
        if (type === 4) return view.getUint32(dataOffset, le);
        if (type === 9) return view.getInt32(dataOffset, le);
        return view.getUint8(dataOffset);
    }

    var TAGS = {
        0x010F: 'Make', 0x0110: 'Model', 0x0112: 'Orientation',
        0x011A: 'XResolution', 0x011B: 'YResolution', 0x0128: 'ResolutionUnit',
        0x0131: 'Software', 0x0132: 'DateTime', 0x013B: 'Artist',
        0x013E: 'WhitePoint', 0x013F: 'PrimaryChromaticities',
        0x0211: 'YCbCrCoefficients', 0x0213: 'YCbCrPositioning',
        0x0214: 'ReferenceBlackWhite', 0x8298: 'Copyright',
        0x9000: 'ExifVersion', 0x9003: 'DateTimeOriginal',
        0x9004: 'DateTimeDigitized', 0x9101: 'ComponentsConfiguration',
        0x9102: 'CompressedBitsPerPixel', 0x9201: 'ShutterSpeedValue',
        0x9202: 'ApertureValue', 0x9203: 'BrightnessValue',
        0x9204: 'ExposureBiasValue', 0x9205: 'MaxApertureValue',
        0x9206: 'SubjectDistance', 0x9207: 'MeteringMode',
        0x9208: 'LightSource', 0x9209: 'Flash', 0x920A: 'FocalLength',
        0x9214: 'SubjectArea', 0x927C: 'MakerNote',
        0x9286: 'UserComment', 0x9290: 'SubSecTime',
        0x9291: 'SubSecTimeOriginal', 0x9292: 'SubSecTimeDigitized',
        0xA000: 'FlashpixVersion', 0xA001: 'ColorSpace',
        0xA002: 'PixelXDimension', 0xA003: 'PixelYDimension',
        0xA004: 'RelatedSoundFile', 0xA20B: 'FlashEnergy',
        0xA20C: 'SpatialFrequencyResponse', 0xA20E: 'FocalPlaneXResolution',
        0xA20F: 'FocalPlaneYResolution', 0xA210: 'FocalPlaneResolutionUnit',
        0xA214: 'SubjectLocation', 0xA215: 'ExposureIndex',
        0xA217: 'SensingMethod', 0xA300: 'FileSource',
        0xA301: 'SceneType', 0xA302: 'CFAPattern',
        0xA401: 'CustomRendered', 0xA402: 'ExposureMode',
        0xA403: 'WhiteBalance', 0xA404: 'DigitalZoomRatio',
        0xA405: 'FocalLengthIn35mmFilm', 0xA406: 'SceneCaptureType',
        0xA407: 'GainControl', 0xA408: 'Contrast',
        0xA409: 'Saturation', 0xA40A: 'Sharpness',
        0xA40B: 'DeviceSettingDescription', 0xA40C: 'SubjectDistanceRange',
        0xA420: 'ImageUniqueID', 0x829A: 'ExposureTime',
        0x829D: 'FNumber', 0x8822: 'ExposureProgram',
        0x8824: 'SpectralSensitivity', 0x8827: 'ISOSpeedRatings',
        // GPS Tags (read under 0x8825 IFD)
        0x0000: 'GPSVersionID', 0x0001: 'GPSLatitudeRef',
        0x0002: 'GPSLatitude', 0x0003: 'GPSLongitudeRef',
        0x0004: 'GPSLongitude', 0x0005: 'GPSAltitudeRef',
        0x0006: 'GPSAltitude', 0x0007: 'GPSTimeStamp',
        0x0008: 'GPSSatellites', 0x0009: 'GPSStatus',
        0x000A: 'GPSMeasureMode', 0x000B: 'GPSDOP',
        0x000C: 'GPSSpeedRef', 0x000D: 'GPSSpeed',
        0x000E: 'GPSTrackRef', 0x000F: 'GPSTrack',
        0x0010: 'GPSImgDirectionRef', 0x0011: 'GPSImgDirection',
        0x0012: 'GPSMapDatum', 0x0013: 'GPSDestLatitudeRef',
        0x0014: 'GPSDestLatitude', 0x0015: 'GPSDestLongitudeRef',
        0x0016: 'GPSDestLongitude', 0x001D: 'GPSDateStamp'
    };
}());
