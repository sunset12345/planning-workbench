"""Add stable identities and embedded attachment bytes to the maintained HTML."""
import base64
import html
import json
import mimetypes
import re
import uuid

CATEGORIES = ['revisions', 'mindmap', 'description', 'config', 'ui', 'localization', 'audio', 'redpoint', 'analytics', 'attachments']


def prepare_html(source, root):
    registry_path = root / '制作脚本/identities.json'
    registry = json.loads(registry_path.read_text()) if registry_path.exists() else {}

    def identity(key):
        # Keys refer to existing source anchors, never titles. Persist generated IDs.
        if key not in registry:
            registry[key] = str(uuid.uuid4())
        return registry[key]

    doc_id, feature_id = identity('document'), identity('feature')

    def section(match):
        opening, anchor, body = match.groups()
        number = int(anchor.split('-')[1])
        category = CATEGORIES[number - 1]
        heading = re.match(r'<h2>.*?</h2>', body).group()
        rest = body[len(heading):]
        pieces = re.split(r'(?=<h[34]\s+id=")', rest)
        rendered = []
        for piece in pieces:
            if not piece.strip():
                continue
            hm = re.match(r'<h[34]\s+id="([^"]+)"[^>]*>(.*?)</h[34]>', piece)
            block_anchor = hm[1] if hm else anchor + '-intro'
            subtype = 'other'
            if category == 'description':
                subtype = 'rule' if hm else 'overview'
            elif category == 'config':
                subtype = 'config'
            elif category == 'ui':
                subtype = 'scenario' if block_anchor == 'ui-01-states' else 'ui-page'
            elif category in ('audio', 'attachments'):
                subtype = 'resource'
            attrs = f'data-block-id="{identity("block:" + block_anchor)}" data-anchor="{block_anchor}" data-subtype="{subtype}"'
            if not hm:
                attrs += f' id="{block_anchor}"'
            rendered.append(f'<div class="planning-block" {attrs}>{piece}</div>')
        opening = opening[:-1] + f' data-section-id="{identity("section:" + anchor)}" data-category="{category}">'
        return opening + heading + ''.join(rendered) + '</section>'

    source = re.sub(r'(<section class="chapter search-unit" id="(section-\d+)">)(.*?)</section>', section, source, flags=re.S)
    source = source.replace('<main>', f'<main data-document-id="{doc_id}">', 1)
    assets = []
    for folder, role in [('需求表', 'requirements'), ('配置表', 'config'), ('图示', 'ui-source')]:
        for p in sorted((root / folder).iterdir()):
            if not p.is_file() or p.suffix not in ('.xlsx', '.json', '.csv', '.svg'):
                continue
            rel = p.relative_to(root).as_posix()
            actual_role = next((kind for kind in ['美术需求', 'UI需求', '特效需求'] if kind in p.name), role)
            assets.append(dict(id=identity('attachment:' + rel), path=rel, name=p.name, mediaType=mimetypes.guess_type(p.name)[0] or 'application/octet-stream', role=actual_role, data=base64.b64encode(p.read_bytes()).decode()))
    for filename, role in [('抽奖演示稿.html', 'demo'), ('使用说明.txt', 'readme')]:
        p = root / filename
        assets.append(dict(id=identity('attachment:' + filename), path=filename, name=filename, mediaType=mimetypes.guess_type(filename)[0] or 'text/plain', role=role, data=base64.b64encode(p.read_bytes()).decode()))
    metadata = dict(format='game-feature-planning', schemaVersion=1, project=None, systems=[], features=[dict(id=feature_id, systemId=None, name='简单抽奖')], document=dict(id=doc_id, title='简单抽奖功能策划案', version='V0.7', ownerType='feature', ownerId=feature_id), diagrams={key: identity('diagram:' + key) for key in ['M01', 'F01', 'C01', 'UI-01', 'UI-02', 'UI-03', 'UI-04']})
    encode = lambda value: json.dumps(value, ensure_ascii=False, indent=2).replace('<', '\\u003c')
    data = '<script type="application/json" id="planning-meta">' + encode(metadata) + '</script><script type="application/json" id="planning-assets">' + encode(assets) + '</script>'
    source = source.replace('<script type="application/json" id="graph-data">', data + '<script type="application/json" id="graph-data">')
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n')
    return source
