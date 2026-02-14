import {AdapterNoteRepository} from 'src/infrastructure/repositories/adapter.note-repository';
import {DefaultDateParserFactory} from 'src/infrastructure/factories/default.date-parser-factory';
import {DefaultDateRepositoryFactory} from 'src/infrastructure/factories/default.date-repository-factory';
import {DisplayNotesSettings, DEFAULT_DISPLAY_NOTES_SETTINGS} from 'src/domain/settings/display-notes.settings';
import {Note} from 'src/domain/models/note.model';
import {Period, PeriodType} from 'src/domain/models/period.model';
import {SettingsRepositoryFactory, SettingsType} from 'src/infrastructure/contracts/settings-repository-factory';
import {NoteAdapter} from 'src/infrastructure/adapters/note.adapter';
import {SettingsRepository} from 'src/infrastructure/contracts/settings-repository';

// We want to test the AdapterNoteRepository with real date parsing logic
// to ensure the fix for numeric properties works correctly.
describe('AdapterNoteRepository (Integration)', () => {
    let repository: AdapterNoteRepository;
    let noteAdapter: jest.Mocked<NoteAdapter>;
    let settingsRepositoryFactory: jest.Mocked<SettingsRepositoryFactory>;
    let settingsRepository: jest.Mocked<SettingsRepository<DisplayNotesSettings>>;

    beforeEach(() => {
        // Real implementations for date logic
        const dateParserFactory = new DefaultDateParserFactory();
        const dateRepositoryFactory = new DefaultDateRepositoryFactory(dateParserFactory);

        // Mocks for external dependencies
        noteAdapter = {
            getActiveNote: jest.fn(),
            getNotes: jest.fn()
        };

        settingsRepository = {
            get: jest.fn(),
            save: jest.fn()
        };

        settingsRepositoryFactory = {
            getRepository: jest.fn().mockReturnValue(settingsRepository)
        };

        repository = new AdapterNoteRepository(
            noteAdapter,
            dateRepositoryFactory,
            dateParserFactory,
            settingsRepositoryFactory
        );
    });

    it('should correctly parse a createdOn property that is a number (e.g. 20231002)', async () => {
        // Arrange
        const settings: DisplayNotesSettings = {
            ...DEFAULT_DISPLAY_NOTES_SETTINGS,
            createdOnDatePropertyName: 'created_on',
            createdOnPropertyFormat: 'yyyyMMdd',
            displayDateTemplate: 'yyyy-MM-dd'
        };

        // Simulate a note where the property is a number (runtime behavior)
        const numericProperty = 20231002;
        const properties = new Map<string, any>();
        properties.set('created_on', numericProperty);

        const note: Note = {
            createdOn: {
                date: new Date(),
                name: 'Today',
                type: PeriodType.Day
            },
            createdOnProperty: null,
            name: 'Test Note',
            path: 'test/note.md',
            properties: properties as Map<string, string> // Type assertion to bypass TS check for test
        };

        settingsRepository.get.mockResolvedValue(settings);
        noteAdapter.getActiveNote.mockResolvedValue(note);

        // Act
        const result = await repository.getActiveNote();

        // Assert
        expect(result).not.toBeNull();
        expect(result?.createdOnProperty).not.toBeNull();
        // The numeric property 20231002 should be parsed as 2023-10-02
        expect(result?.createdOnProperty?.date.getFullYear()).toBe(2023);
        expect(result?.createdOnProperty?.date.getMonth()).toBe(9); // Month is 0-indexed (9 = October)
        expect(result?.createdOnProperty?.date.getDate()).toBe(2);
    });
});
