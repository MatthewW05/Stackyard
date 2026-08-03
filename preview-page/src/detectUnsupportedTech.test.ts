import { describe, it, expect } from 'vitest';
import { detectUnsupportedTech } from './detectUnsupportedTech';

describe('detectUnsupportedTech', () => {
  it('returns null for an empty file list', () => {
    expect(detectUnsupportedTech([])).toBeNull();
  });

  it('returns null for a plain JS project', () => {
    expect(detectUnsupportedTech(['package.json', 'src/index.js', 'README.md'])).toBeNull();
  });

  it('returns null for an unrecognized project type', () => {
    expect(detectUnsupportedTech(['README.md', 'Makefile', 'src/main.c'])).toBeNull();
  });

  describe('Python', () => {
    it('detects requirements.txt at root', () => {
      const result = detectUnsupportedTech(['requirements.txt', 'app.py']);
      expect(result?.tech).toBe('Python');
    });

    it('detects requirements.txt nested in a subdirectory', () => {
      const result = detectUnsupportedTech(['backend/requirements.txt', 'backend/app.py']);
      expect(result?.tech).toBe('Python');
    });

    it('detects pyproject.toml', () => {
      const result = detectUnsupportedTech(['pyproject.toml', 'src/main.py']);
      expect(result?.tech).toBe('Python');
    });

    it('detects setup.py', () => {
      const result = detectUnsupportedTech(['setup.py']);
      expect(result?.tech).toBe('Python');
    });

    it('detects .py files without an explicit config marker', () => {
      const result = detectUnsupportedTech(['src/views.py', 'src/models.py']);
      expect(result?.tech).toBe('Python');
    });

    it('message mentions Flask, Django, FastAPI', () => {
      const result = detectUnsupportedTech(['requirements.txt']);
      expect(result?.message).toMatch(/Flask/);
      expect(result?.message).toMatch(/Django/);
      expect(result?.message).toMatch(/FastAPI/);
    });
  });

  describe('Java (Maven)', () => {
    it('detects pom.xml at root', () => {
      const result = detectUnsupportedTech(['pom.xml', 'src/main/java/App.java']);
      expect(result?.tech).toBe('Java (Maven)');
    });

    it('detects pom.xml nested in a subdirectory', () => {
      const result = detectUnsupportedTech(['backend/pom.xml']);
      expect(result?.tech).toBe('Java (Maven)');
    });
  });

  describe('Java/Kotlin (Gradle)', () => {
    it('detects build.gradle at root', () => {
      const result = detectUnsupportedTech(['build.gradle', 'src/main/java/App.java']);
      expect(result?.tech).toBe('Java/Kotlin (Gradle)');
    });

    it('detects build.gradle.kts', () => {
      const result = detectUnsupportedTech(['build.gradle.kts']);
      expect(result?.tech).toBe('Java/Kotlin (Gradle)');
    });

    it('detects build.gradle nested in a subdirectory', () => {
      const result = detectUnsupportedTech(['app/build.gradle']);
      expect(result?.tech).toBe('Java/Kotlin (Gradle)');
    });
  });

  describe('Ruby', () => {
    it('detects Gemfile at root', () => {
      const result = detectUnsupportedTech([
        'Gemfile',
        'app/controllers/application_controller.rb',
      ]);
      expect(result?.tech).toBe('Ruby');
    });

    it('detects Gemfile nested in a subdirectory', () => {
      const result = detectUnsupportedTech(['backend/Gemfile']);
      expect(result?.tech).toBe('Ruby');
    });

    it('message mentions Rails and Sinatra', () => {
      const result = detectUnsupportedTech(['Gemfile']);
      expect(result?.message).toMatch(/Rails/);
      expect(result?.message).toMatch(/Sinatra/);
    });
  });

  describe('Go', () => {
    it('detects go.mod at root', () => {
      const result = detectUnsupportedTech(['go.mod', 'main.go']);
      expect(result?.tech).toBe('Go');
    });

    it('detects go.mod nested in a subdirectory', () => {
      const result = detectUnsupportedTech(['backend/go.mod']);
      expect(result?.tech).toBe('Go');
    });
  });

  describe('Rust', () => {
    it('detects Cargo.toml at root', () => {
      const result = detectUnsupportedTech(['Cargo.toml', 'src/main.rs']);
      expect(result?.tech).toBe('Rust');
    });

    it('detects Cargo.toml nested in a subdirectory', () => {
      const result = detectUnsupportedTech(['crates/my-crate/Cargo.toml']);
      expect(result?.tech).toBe('Rust');
    });
  });

  it('Python takes priority when multiple markers are present', () => {
    // Edge case: a repo with both Python and Gemfile markers
    const result = detectUnsupportedTech(['requirements.txt', 'Gemfile']);
    expect(result?.tech).toBe('Python');
  });

  it('message always mentions WebContainer is Node.js-only', () => {
    const techs = [
      ['requirements.txt'],
      ['pom.xml'],
      ['build.gradle'],
      ['Gemfile'],
      ['go.mod'],
      ['Cargo.toml'],
    ];
    for (const paths of techs) {
      const result = detectUnsupportedTech(paths);
      expect(result?.message).toMatch(/Node\.js/);
    }
  });
});
