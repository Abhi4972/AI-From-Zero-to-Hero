"""Print a source lesson compactly: prose and headings, code blocks shortened."""
import re,sys,pathlib
for arg in sys.argv[1:]:
    d=next(pathlib.Path('/home/claude/upstream/phases').glob(f'{arg[:2]}-*/{arg[2:]}-*'))
    t=(d/'docs/en.md').read_text()
    def fence(m):
        lang=m.group(1); body=m.group(2).splitlines()
        if lang in('mermaid','figure','math'): return f'```{lang}\n'+'\n'.join(body[:14])+'\n```'
        return f'```{lang} ({len(body)} lines)\n'+'\n'.join(body[:int(sys.argv[0] and 8)])+('\n...' if len(body)>8 else '')+'\n```'
    t=re.sub(r'^```(\w*)[^\n]*\n(.*?)^```',fence,t,flags=re.S|re.M)
    print('=====',d.name, '| code:', ' '.join(p.name for p in (d/'code').glob('*')) if (d/'code').exists() else '')
    print(t)
