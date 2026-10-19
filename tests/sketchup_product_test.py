import importlib.util
import json
from pathlib import Path
import struct
import unittest

spec = importlib.util.spec_from_file_location('skp_convert', Path(__file__).resolve().parents[1] / 'scripts/sketchup/convert.py')
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)

def glb(document, payload_size=4):
    text = json.dumps(document).encode()
    text += b' ' * (-len(text) % 4)
    payload_size += -payload_size % 4
    return struct.pack('<III', 0x46546c67, 2, 28 + len(text) + payload_size) + struct.pack('<II', len(text), 0x4e4f534a) + text + struct.pack('<II', payload_size, 0x004e4942) + bytes(payload_size)

class ProductConversionLimits(unittest.TestCase):
    def test_product_flag_does_not_remove_server_marker_requirement(self):
        data = glb({'nodes': [{}]})
        with self.assertRaisesRegex(ValueError, 'marker'):
            converter.GLB(data)
        self.assertEqual(converter.GLB(data, product=True).max_accessor_count, 1500000)

    def test_larger_limit_is_opt_in(self):
        data = glb({'nodes': [{'extras': {'kitchenExport': True}}]}, 4 * 1024 * 1024)
        with self.assertRaisesRegex(ValueError, 'Invalid GLB'):
            converter.GLB(data)
        converter.GLB(data, product=True)

    def test_product_mode_still_rejects_external_compressed_and_animated_data(self):
        for document in [
            {'images': [{'uri': 'https://example.test/texture.png'}]},
            {'extensionsRequired': ['KHR_texture_basisu']},
            {'extensionsRequired': ['KHR_mesh_quantization']},
            {'animations': [{}]},
            {'skins': [{}]},
        ]:
            with self.subTest(document=document), self.assertRaises(ValueError):
                converter.GLB(glb(document), product=True)

if __name__ == '__main__':
    unittest.main()
