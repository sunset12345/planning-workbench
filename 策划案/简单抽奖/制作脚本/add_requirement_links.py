"""Supply native relative hyperlinks, a capability unavailable in this authoring API."""
from pathlib import Path
import json
import zipfile
import xml.etree.ElementTree as ET
from urllib.parse import quote

root = Path(__file__).resolve().parents[1]
rows = json.loads((root / '制作脚本/requirements.json').read_text())
ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
rel_ns = 'http://schemas.openxmlformats.org/package/2006/relationships'
office_ns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
ET.register_namespace('', ns)
ET.register_namespace('r', office_ns)

for kind, records in rows.items():
    path = root / f'需求表/简单抽奖_{kind}.xlsx'
    with zipfile.ZipFile(path) as z:
        files = {name: z.read(name) for name in z.namelist()}
    worksheet = ET.fromstring(files['xl/worksheets/sheet1.xml'])
    rel_path = 'xl/worksheets/_rels/sheet1.xml.rels'
    rels = ET.fromstring(files[rel_path]) if rel_path in files else ET.Element(f'{{{rel_ns}}}Relationships')
    links = ET.Element(f'{{{ns}}}hyperlinks')
    column = chr(64 + len(records[0]))
    for i, row in enumerate(records, 7):
        target, anchor = row[-1].split('#')
        rid = f'planningLink{i}'
        ET.SubElement(links, f'{{{ns}}}hyperlink', {'ref': f'{column}{i}', f'{{{office_ns}}}id': rid, 'location': anchor})
        ET.SubElement(rels, f'{{{rel_ns}}}Relationship', {'Id': rid, 'Type': office_ns + '/hyperlink', 'Target': quote(target, safe='/.'), 'TargetMode': 'External'})
    insertion = next((i for i, el in enumerate(worksheet) if el.tag.split('}')[-1] in ('printOptions', 'pageMargins', 'pageSetup', 'headerFooter', 'drawing', 'tableParts', 'extLst')), len(worksheet))
    worksheet.insert(insertion, links)
    files['xl/worksheets/sheet1.xml'] = ET.tostring(worksheet, encoding='utf-8', xml_declaration=True)
    files[rel_path] = ET.tostring(rels, encoding='utf-8', xml_declaration=True)
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, data in files.items():
            z.writestr(name, data)
    # Keep Artifact Tool's automatic inspection sidecars out of user attachments.
    sidecar = path.with_suffix('.xlsx.inspect.ndjson')
    if sidecar.exists():
        sidecar.replace(root / '制作脚本/检查记录' / sidecar.name)
